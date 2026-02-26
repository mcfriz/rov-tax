import { useEffect, useMemo, useState } from 'react'
import type { DayKey, DutyType, SectorDefault, Trip, TripType } from '../../data/types'

type Props = {
  trip: Trip | null
  seedType: TripType | null
  seedRange?: { startDayKey: DayKey; endDayKey: DayKey }
  onClose: () => void
  onSave: (trip: Omit<Trip, 'id' | 'createdAt' | 'updatedAt' | 'colourTag'> & { id?: string }) => void
  tripDefaults: Record<TripType, Pick<Trip, 'sectorDefault' | 'dutyDefault' | 'countsTowardSedDefault'>>
}

const tripTypeOptions: Array<{ value: TripType; label: string }> = [
  { value: 'OFFSHORE_WORK', label: 'Offshore Work' },
  { value: 'HOLIDAY_ABROAD', label: 'Holiday Abroad' },
  { value: 'TRAINING_ABROAD', label: 'Training Abroad' },
  { value: 'TRANSIT', label: 'Transit' },
  { value: 'UK_WATERS_WORK', label: 'UK Waters Work' },
]

const sectorOptions: Array<{ value: SectorDefault; label: string }> = [
  { value: 'UK_OUTSIDE_12NM', label: 'Outside UK' },
  { value: 'UK_INSIDE_12NM', label: 'Inside 12nm UK' },
  { value: 'NORWAY', label: 'Norway' },
  { value: 'OTHER', label: 'Unknown' },
]

const dutyOptions: DutyType[] = ['OFFSHORE', 'LEAVE', 'TRANSIT', 'TRAINING', 'SICK', 'OTHER']

function getTodayKey(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function defaultCountsTowardSed(tripType: TripType, sectorDefault: SectorDefault): boolean {
  if (sectorDefault === 'UK_INSIDE_12NM') {
    return false
  }
  if (tripType === 'UK_HOME') {
    return false
  }
  return true
}

export default function TripModal({ trip, seedType, seedRange, onClose, onSave, tripDefaults }: Props) {
  const todayKey = useMemo(() => getTodayKey(), [])

  const defaults = seedType ? tripDefaults[seedType] : trip?.tripType ? tripDefaults[trip.tripType] : null

  const [title, setTitle] = useState(trip?.title ?? '')
  const [tripType, setTripType] = useState<TripType>(trip?.tripType ?? seedType ?? 'OFFSHORE_WORK')
  const [startDayKey, setStartDayKey] = useState(trip?.startDayKey ?? seedRange?.startDayKey ?? todayKey)
  const [endDayKey, setEndDayKey] = useState(trip?.endDayKey ?? seedRange?.endDayKey ?? todayKey)
  const [vessel, setVessel] = useState(trip?.vessel ?? '')
  const [sectorDefault, setSectorDefault] = useState<SectorDefault>(
    trip?.sectorDefault ?? defaults?.sectorDefault ?? 'UK_OUTSIDE_12NM',
  )
  const [dutyDefault, setDutyDefault] = useState<DutyType>(
    trip?.dutyDefault ?? defaults?.dutyDefault ?? 'OFFSHORE',
  )

  useEffect(() => {
    document.body.classList.add('modal-open')
    return () => {
      document.body.classList.remove('modal-open')
    }
  }, [])

  useEffect(() => {
    if (seedType) {
      const seedDefaults = tripDefaults[seedType]
      setTripType(seedType)
      setSectorDefault(seedDefaults.sectorDefault)
      setDutyDefault(seedDefaults.dutyDefault)
      if (!title) {
        setTitle(seedType.replace('_', ' ').toLowerCase())
      }
    }
  }, [seedType, tripDefaults, title])

  const handleSubmit = () => {
    const trimmedTitle = title.trim() || 'Untitled Trip'
    onSave({
      id: trip?.id,
      title: trimmedTitle,
      tripType,
      startDayKey,
      endDayKey,
      vessel: vessel.trim() || undefined,
      sectorDefault,
      dutyDefault,
      countsTowardSedDefault: defaultCountsTowardSed(tripType, sectorDefault),
      planned: trip?.planned ?? false,
    })
  }

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true">
      <div className="modal-card">
        <header>
          <h3>{trip ? 'Edit Trip' : 'Add Trip'}</h3>
          <button type="button" className="icon-button" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="modal-body">
          <label>
            Title
            <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>

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

          <label>
            Vessel (optional)
            <input type="text" value={vessel} onChange={(event) => setVessel(event.target.value)} />
          </label>

          <label>
            Sector Default
            <select
              value={sectorDefault}
              onChange={(event) => setSectorDefault(event.target.value as SectorDefault)}
            >
              {sectorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Duty Default
            <select value={dutyDefault} onChange={(event) => setDutyDefault(event.target.value as DutyType)}>
              {dutyOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <footer>
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={handleSubmit}>
            Save Trip
          </button>
        </footer>
      </div>
    </div>
  )
}
