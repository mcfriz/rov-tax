import { useEffect, useMemo, useState } from 'react'
import type { DayKey, DutyType, SectorDefault, Trip, TripType, DayOverride } from '../../data/types'

type SectorSelection = SectorDefault | 'MIXED'

export type TripModalSavePayload = Omit<Trip, 'id' | 'createdAt' | 'updatedAt' | 'colourTag'> & {
  id?: string
  mixedDaySectors?: Record<DayKey, SectorDefault>
}

type Props = {
  trip: Trip | null
  seedType: TripType | null
  seedRange?: { startDayKey: DayKey; endDayKey: DayKey }
  overrides?: Record<DayKey, DayOverride>
  saveWarning?: string | null
  onClose: () => void
  onSave: (trip: TripModalSavePayload) => void
  tripDefaults: Record<TripType, Pick<Trip, 'sectorDefault' | 'dutyDefault' | 'countsTowardSedDefault'>>
}

const tripTypeOptions: Array<{ value: TripType; label: string }> = [
  { value: 'OFFSHORE_WORK', label: 'Offshore Work' },
  { value: 'HOLIDAY_ABROAD', label: 'Holiday Abroad' },
  { value: 'TRAINING_ABROAD', label: 'Training Abroad' },
]

const sectorOptions: Array<{ value: SectorDefault; label: string }> = [
  { value: 'UK_OUTSIDE_12NM', label: 'Outside UK' },
  { value: 'UK_INSIDE_12NM', label: 'Inside 12nm UK' },
  { value: 'NORWAY', label: 'Norway' },
  { value: 'OTHER', label: 'Unknown' },
]

const dayMs = 24 * 60 * 60 * 1000

function getTodayKey(): DayKey {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDayKey(dayKey: DayKey): Date {
  const [year, month, day] = dayKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDayKey(date: Date): DayKey {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getRangeDayKeys(startDayKey: DayKey, endDayKey: DayKey): DayKey[] {
  const start = parseDayKey(startDayKey)
  const end = parseDayKey(endDayKey)
  const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / dayMs))
  const keys: DayKey[] = []

  for (let i = 0; i <= days; i += 1) {
    keys.push(formatDayKey(new Date(start.getTime() + i * dayMs)))
  }
  return keys
}

function getDutyDefault(tripType: TripType): DutyType {
  if (tripType === 'HOLIDAY_ABROAD') {
    return 'LEAVE'
  }
  if (tripType === 'TRAINING_ABROAD') {
    return 'TRAINING'
  }
  return 'OFFSHORE'
}

function defaultCountsTowardSed(tripType: TripType, sectorDefault: SectorDefault): boolean {
  if (tripType === 'HOLIDAY_ABROAD' || tripType === 'TRAINING_ABROAD') {
    return true
  }
  return sectorDefault !== 'UK_INSIDE_12NM' && sectorDefault !== 'OTHER'
}

export default function TripModal({
  trip,
  seedType,
  seedRange,
  overrides = {},
  saveWarning,
  onClose,
  onSave,
  tripDefaults,
}: Props) {
  const todayKey = useMemo(() => getTodayKey(), [])

  const defaults = seedType ? tripDefaults[seedType] : trip?.tripType ? tripDefaults[trip.tripType] : null

  const [title, setTitle] = useState(trip?.title ?? '')
  const [tripType, setTripType] = useState<TripType>(
    trip && ['OFFSHORE_WORK', 'HOLIDAY_ABROAD', 'TRAINING_ABROAD'].includes(trip.tripType)
      ? trip.tripType
      : seedType && ['OFFSHORE_WORK', 'HOLIDAY_ABROAD', 'TRAINING_ABROAD'].includes(seedType)
        ? seedType
        : 'OFFSHORE_WORK',
  )
  const [startDayKey, setStartDayKey] = useState(trip?.startDayKey ?? seedRange?.startDayKey ?? todayKey)
  const [endDayKey, setEndDayKey] = useState(trip?.endDayKey ?? seedRange?.endDayKey ?? todayKey)
  const [vessel, setVessel] = useState(trip?.vessel ?? '')
  const [sectorSelection, setSectorSelection] = useState<SectorSelection>(
    trip?.tripType === 'OFFSHORE_WORK' && trip.sectorDefault === 'OTHER'
      ? 'MIXED'
      : trip?.sectorDefault ?? defaults?.sectorDefault ?? 'UK_OUTSIDE_12NM',
  )
  const [mixedDaySectors, setMixedDaySectors] = useState<Record<DayKey, SectorDefault>>({})
  const [bulkMixedSector, setBulkMixedSector] = useState<SectorDefault>('UK_OUTSIDE_12NM')

  const isOffshore = tripType === 'OFFSHORE_WORK'
  const isHoliday = tripType === 'HOLIDAY_ABROAD'
  const isTraining = tripType === 'TRAINING_ABROAD'
  const isMixed = isOffshore && sectorSelection === 'MIXED'
  const rangeDayKeys = useMemo(() => getRangeDayKeys(startDayKey, endDayKey), [startDayKey, endDayKey])
  const dateRangeInvalid = startDayKey > endDayKey

  useEffect(() => {
    document.body.classList.add('modal-open')
    return () => {
      document.body.classList.remove('modal-open')
    }
  }, [])

  useEffect(() => {
    if (!seedType) {
      return
    }
    const seedDefaults = tripDefaults[seedType]
    if (['OFFSHORE_WORK', 'HOLIDAY_ABROAD', 'TRAINING_ABROAD'].includes(seedType)) {
      setTripType(seedType)
    }
    setSectorSelection(seedDefaults.sectorDefault)
    if (!title) {
      setTitle(seedType.replace('_', ' ').toLowerCase())
    }
  }, [seedType, title, tripDefaults])

  useEffect(() => {
    if (!isMixed) {
      return
    }
    setMixedDaySectors((prev) => {
      const next: Record<DayKey, SectorDefault> = {}
      for (const dayKey of rangeDayKeys) {
        if (prev[dayKey]) {
          next[dayKey] = prev[dayKey]
          continue
        }
        const override = overrides[dayKey]
        if (override?.midnightLocation === 'INSIDE_12NM_UK') {
          next[dayKey] = 'UK_INSIDE_12NM'
        } else if (override?.midnightLocation === 'NORWAY_SECTOR') {
          next[dayKey] = 'NORWAY'
        } else if (override?.midnightLocation === 'OUTSIDE_UK') {
          next[dayKey] = 'UK_OUTSIDE_12NM'
        } else if (override?.midnightLocation === 'UNKNOWN') {
          next[dayKey] = 'OTHER'
        } else {
          next[dayKey] = 'UK_OUTSIDE_12NM'
        }
      }
      return next
    })
  }, [isMixed, overrides, rangeDayKeys])

  const handleSubmit = () => {
    const finalSector: SectorDefault = isOffshore
      ? sectorSelection === 'MIXED'
        ? 'OTHER'
        : sectorSelection
      : 'UK_OUTSIDE_12NM'

    const finalTitle = title.trim() || (isHoliday ? 'Holiday Abroad' : isTraining ? 'Training Abroad' : 'Offshore Work')
    const mixedPayload = isMixed
      ? Object.fromEntries(
          rangeDayKeys.map((dayKey) => [dayKey, mixedDaySectors[dayKey] ?? 'UK_OUTSIDE_12NM']),
        )
      : undefined

    onSave({
      id: trip?.id,
      title: finalTitle,
      tripType,
      startDayKey,
      endDayKey,
      vessel: isOffshore ? vessel.trim() || undefined : undefined,
      sectorDefault: finalSector,
      dutyDefault: getDutyDefault(tripType),
      countsTowardSedDefault: defaultCountsTowardSed(tripType, finalSector),
      planned: trip?.planned ?? false,
      mixedDaySectors: mixedPayload,
    })
  }

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true">
      <div className="modal-card">
        <header>
          <h3>{trip ? 'Edit Trip' : 'Add Trip'}</h3>
        </header>

        <div className="modal-body">
          <label>
            Trip Type
            <select value={tripType} onChange={(event) => setTripType(event.target.value as TripType)}>
              {tripTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {(isOffshore || isHoliday || isTraining) ? (
            <label>
              Title
              <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
          ) : null}

          <div className="date-row">
            <label>
              Start Date
              <input
                type="date"
                value={startDayKey}
                onChange={(event) => setStartDayKey(event.target.value)}
              />
            </label>
            <label>
              End Date
              <input type="date" value={endDayKey} onChange={(event) => setEndDayKey(event.target.value)} />
            </label>
          </div>

          {isOffshore ? (
            <>
              <label>
                Vessel (optional)
                <input type="text" value={vessel} onChange={(event) => setVessel(event.target.value)} />
              </label>

              <label>
                Sector Default
                <select value={sectorSelection} onChange={(event) => setSectorSelection(event.target.value as SectorSelection)}>
                  {sectorOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                  <option value="MIXED">Mixed (set per day)</option>
                </select>
              </label>

              {isMixed ? (
                <section className="mixed-sector-editor">
                  <h4>Per-day sector (mixed)</h4>
                  <p className="hint">Set each day sector for this offshore trip.</p>
                  <div className="mixed-sector-bulk">
                    <select
                      value={bulkMixedSector}
                      onChange={(event) => setBulkMixedSector(event.target.value as SectorDefault)}
                    >
                      {sectorOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        setMixedDaySectors(
                          Object.fromEntries(rangeDayKeys.map((dayKey) => [dayKey, bulkMixedSector])),
                        )
                      }
                    >
                      Apply To All Days
                    </button>
                  </div>
                  <div className="mixed-sector-list">
                    {rangeDayKeys.map((dayKey) => (
                      <label key={dayKey} className="mixed-sector-row">
                        <span>{dayKey}</span>
                        <select
                          value={mixedDaySectors[dayKey] ?? 'UK_OUTSIDE_12NM'}
                          onChange={(event) =>
                            setMixedDaySectors((prev) => ({
                              ...prev,
                              [dayKey]: event.target.value as SectorDefault,
                            }))
                          }
                        >
                          {sectorOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}
        </div>

        <footer>
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={handleSubmit} disabled={dateRangeInvalid}>
            Save Trip
          </button>
        </footer>
        {dateRangeInvalid ? (
          <div className="trip-warning modal-warning" role="alert" aria-live="polite">
            <span className="trip-warning-icon" aria-hidden="true">
              !
            </span>
            <div className="trip-warning-body">
              <strong>Check trip dates</strong>
              <p>End date must be on or after start date.</p>
            </div>
          </div>
        ) : null}
        {saveWarning ? (
          <div className="trip-warning modal-warning" role="alert" aria-live="polite">
            <span className="trip-warning-icon" aria-hidden="true">
              !
            </span>
            <div className="trip-warning-body">
              <strong>Cannot save trip</strong>
              <p>{saveWarning}</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
