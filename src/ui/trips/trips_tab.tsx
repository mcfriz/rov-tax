import { useMemo, useState } from 'react'
import type { AppState, DayKey, DayOverride, MidnightLocation, SectorDefault, Trip, TripType } from '../../data/types'
import type { Dispatch, SetStateAction } from 'react'
import { createTrip, deriveTripColour, nowIso, toDayKey } from '../../data/helpers'
import TripModal, { type TripModalSavePayload } from './TripModal'
import RotaTemplateModal from './RotaTemplateModal'
import { generateRotaTrips } from '../../rules/rota_generator'
import { Assets } from '../common/assets'

const tripTypeLabels: Record<TripType, string> = {
  OFFSHORE_WORK: 'Offshore Work',
  HOLIDAY_ABROAD: 'Holiday Abroad',
  TRAINING_ABROAD: 'Training Abroad',
  TRANSIT: 'Transit',
  UK_WATERS_WORK: 'UK Waters Work',
  UK_HOME: 'UK Home',
}

const sectorLabels: Record<SectorDefault, string> = {
  UK_OUTSIDE_12NM: 'Outside UK',
  UK_INSIDE_12NM: 'Inside 12nm UK',
  NORWAY: 'Norway',
  OTHER: 'Unknown',
}

const tripDefaults: Record<TripType, Pick<Trip, 'sectorDefault' | 'dutyDefault' | 'countsTowardSedDefault'>> = {
  OFFSHORE_WORK: {
    sectorDefault: 'UK_OUTSIDE_12NM',
    dutyDefault: 'OFFSHORE',
    countsTowardSedDefault: true,
  },
  HOLIDAY_ABROAD: {
    sectorDefault: 'UK_OUTSIDE_12NM',
    dutyDefault: 'LEAVE',
    countsTowardSedDefault: true,
  },
  TRAINING_ABROAD: {
    sectorDefault: 'UK_OUTSIDE_12NM',
    dutyDefault: 'TRAINING',
    countsTowardSedDefault: true,
  },
  TRANSIT: {
    sectorDefault: 'UK_OUTSIDE_12NM',
    dutyDefault: 'TRANSIT',
    countsTowardSedDefault: true,
  },
  UK_WATERS_WORK: {
    sectorDefault: 'UK_INSIDE_12NM',
    dutyDefault: 'OFFSHORE',
    countsTowardSedDefault: false,
  },
  UK_HOME: {
    sectorDefault: 'OTHER',
    dutyDefault: 'LEAVE',
    countsTowardSedDefault: false,
  },
}

const dayMs = 24 * 60 * 60 * 1000

type Props = {
  state: AppState
  onChange: Dispatch<SetStateAction<AppState>>
}

function formatRange(startDayKey: DayKey, endDayKey: DayKey): string {
  if (startDayKey === endDayKey) {
    return startDayKey
  }
  return `${startDayKey} to ${endDayKey}`
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
  const result: DayKey[] = []

  for (let i = 0; i <= days; i += 1) {
    result.push(formatDayKey(new Date(start.getTime() + i * dayMs)))
  }

  return result
}

function defaultCountsTowardSed(tripType: TripType, sectorDefault: SectorDefault): boolean {
  if (tripType === 'HOLIDAY_ABROAD' || tripType === 'TRAINING_ABROAD') return true
  return sectorDefault !== 'UK_INSIDE_12NM' && sectorDefault !== 'OTHER'
}

function sectorToMidnightLocation(sectorDefault: SectorDefault): MidnightLocation {
  if (sectorDefault === 'UK_INSIDE_12NM') return 'INSIDE_12NM_UK'
  if (sectorDefault === 'NORWAY') return 'NORWAY_SECTOR'
  if (sectorDefault === 'UK_OUTSIDE_12NM') return 'OUTSIDE_UK'
  return 'UNKNOWN'
}

function countsTowardSedForSector(sectorDefault: SectorDefault): boolean {
  return sectorDefault !== 'UK_INSIDE_12NM' && sectorDefault !== 'OTHER'
}

export default function TripsTab({ state, onChange }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isTemplateOpen, setIsTemplateOpen] = useState(false)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [seedType, setSeedType] = useState<TripType | null>(null)
  const [generationSummary, setGenerationSummary] = useState<string | null>(null)
  const [saveWarning, setSaveWarning] = useState<string | null>(null)

  const sortedTrips = useMemo(() => {
    return [...state.trips].sort((a, b) => b.startDayKey.localeCompare(a.startDayKey))
  }, [state.trips])

  const todayKey = toDayKey(new Date())

  const openNewTrip = (tripType?: TripType) => {
    setSaveWarning(null)
    setSeedType(tripType ?? null)
    setEditingTrip(null)
    setIsModalOpen(true)
  }

  const openEditTrip = (trip: Trip) => {
    setSaveWarning(null)
    setEditingTrip(trip)
    setSeedType(null)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setSaveWarning(null)
    setIsModalOpen(false)
    setEditingTrip(null)
    setSeedType(null)
  }

  const rangesOverlap = (aStart: DayKey, aEnd: DayKey, bStart: DayKey, bEnd: DayKey): boolean => {
    return !(aEnd < bStart || bEnd < aStart)
  }

  const handleSave = (draft: TripModalSavePayload) => {
    const { mixedDaySectors, ...tripDraft } = draft
    const conflict = state.trips.find((trip) => {
      if (editingTrip && trip.id === editingTrip.id) {
        return false
      }
      return rangesOverlap(tripDraft.startDayKey, tripDraft.endDayKey, trip.startDayKey, trip.endDayKey)
    })

    if (conflict) {
      setSaveWarning(
        `Dates overlap with "${conflict.title}" (${conflict.startDayKey} to ${conflict.endDayKey}). ` +
          'Only one trip per day is allowed. Edit the dates or update the existing trip.',
      )
      return
    }

    onChange((prev) => {
      const editing = editingTrip ? prev.trips.find((trip) => trip.id === editingTrip.id) : null
      const tripRangeDays = getRangeDayKeys(tripDraft.startDayKey, tripDraft.endDayKey)
      const cleanupDays = new Set<DayKey>(tripRangeDays)
      if (editing) {
        for (const dayKey of getRangeDayKeys(editing.startDayKey, editing.endDayKey)) {
          cleanupDays.add(dayKey)
        }
      }

      const nextOverrides: Record<DayKey, DayOverride> = { ...prev.overrides }
      for (const dayKey of cleanupDays) {
        if (nextOverrides[dayKey]?.source === 'MIXED_TRIP') {
          delete nextOverrides[dayKey]
        }
      }

      if (mixedDaySectors) {
        const editedAt = Date.now()
        for (const [dayKey, sectorDefault] of Object.entries(mixedDaySectors)) {
          const existing = nextOverrides[dayKey]
          nextOverrides[dayKey] = {
            ...existing,
            dayKey,
            midnightLocation: sectorToMidnightLocation(sectorDefault),
            dutyType: 'OFFSHORE',
            countsTowardSed: countsTowardSedForSector(sectorDefault),
            vessel: tripDraft.vessel || existing?.vessel,
            lastEdited: editedAt,
            source: 'MIXED_TRIP',
          }
        }
      }

      let nextTrips: Trip[]
      if (editing) {
        nextTrips = prev.trips.map((trip) => {
          if (trip.id !== editing.id) {
            return trip
          }

          return {
            ...trip,
            ...tripDraft,
            id: trip.id,
            planned: trip.planned,
            countsTowardSedDefault: defaultCountsTowardSed(tripDraft.tripType, tripDraft.sectorDefault),
            updatedAt: nowIso(),
            colourTag: deriveTripColour(tripDraft.tripType),
          }
        })
      } else {
        const nextTrip = createTrip({
          title: tripDraft.title,
          tripType: tripDraft.tripType,
          startDayKey: tripDraft.startDayKey,
          endDayKey: tripDraft.endDayKey,
          vessel: tripDraft.vessel || undefined,
          sectorDefault: tripDraft.sectorDefault,
          dutyDefault: tripDraft.dutyDefault,
          countsTowardSedDefault: defaultCountsTowardSed(tripDraft.tripType, tripDraft.sectorDefault),
          planned: false,
        })

        nextTrips = [...prev.trips, nextTrip]
      }

      return {
        ...prev,
        trips: nextTrips,
        overrides: nextOverrides,
      }
    })

    setSaveWarning(null)
    closeModal()
  }

  const handleDelete = (tripId: string) => {
    onChange((prev) => {
      const tripToDelete = prev.trips.find((trip) => trip.id === tripId)
      if (!tripToDelete) {
        return prev
      }

      const remainingTrips = prev.trips.filter((trip) => trip.id !== tripId)
      const nextOverrides = { ...prev.overrides }
      const affectedDays = getRangeDayKeys(tripToDelete.startDayKey, tripToDelete.endDayKey)

      for (const dayKey of affectedDays) {
        if (nextOverrides[dayKey]?.source === 'MIXED_TRIP') {
          delete nextOverrides[dayKey]
          continue
        }
        const stillCovered = remainingTrips.some((trip) => dayKey >= trip.startDayKey && dayKey <= trip.endDayKey)
        if (!stillCovered) {
          delete nextOverrides[dayKey]
        }
      }

      return {
        ...prev,
        trips: remainingTrips,
        overrides: nextOverrides,
      }
    })
  }

  const handleAddTemplate = () => {
    setIsTemplateOpen(true)
  }

  const handleTemplateClose = () => {
    setIsTemplateOpen(false)
  }

  const handleTemplateSave = (payload: {
    startDayKey: DayKey
    onWeeks: number
    offWeeks: number
    cycles?: number
    endDayKey?: DayKey
    defaultVessel?: string
    offshoreSector: SectorDefault
  }) => {
    const result = generateRotaTrips(state.trips, payload)

    if (result.plannedTrips.length > 0) {
      onChange((prev) => ({
        ...prev,
        trips: [...prev.trips, ...result.plannedTrips],
      }))
    }

    const summaryParts = []
    summaryParts.push(`Generated ${result.plannedTrips.length} planned trips.`)
    if (result.skippedConfirmedOverlaps > 0) {
      summaryParts.push(`Skipped ${result.skippedConfirmedOverlaps} overlaps with confirmed trips.`)
    }
    if (result.skippedPlannedOverlaps > 0) {
      summaryParts.push(`Skipped ${result.skippedPlannedOverlaps} overlaps with planned trips.`)
    }
    setGenerationSummary(summaryParts.join(' '))

    setIsTemplateOpen(false)
  }

  return (
    <div className="page trips">
      <header className="page-header">
        <h2>Trips</h2>
        <p>Capture your rotations first, then refine days as needed.</p>
      </header>

      <section className="trips-actions">
        <button className="primary-button" type="button" onClick={() => openNewTrip()}>
          Add Trip
        </button>
        <button className="ghost-button" type="button" onClick={handleAddTemplate}>
          Add Rotation Plan
        </button>
      </section>

      {saveWarning ? (
        <div className="trip-warning" role="alert" aria-live="polite">
          <span className="trip-warning-icon" aria-hidden="true">
            !
          </span>
          <div className="trip-warning-body">
            <strong>Cannot save trip</strong>
            <p>{saveWarning}</p>
          </div>
        </div>
      ) : null}
      {generationSummary ? <div className="card generation-summary">{generationSummary}</div> : null}

      <section className="trips-list">
        {sortedTrips.length === 0 ? (
          <div className="card empty-state">
            <img className="empty-illustration" src={Assets.backgrounds.emptyState} alt="" aria-hidden="true" />
            <div className="empty-content">
              <h3 className="empty-title">No trips yet</h3>
              <p>Add your first trip to start tracking your rotations.</p>
              <button type="button" className="primary-button" onClick={() => openNewTrip()}>
                Add Trip
              </button>
            </div>
          </div>
        ) : (
          sortedTrips.map((trip) => {
            const isPast = trip.endDayKey < todayKey
            const showUkTag = trip.sectorDefault === 'UK_INSIDE_12NM'
            const showNorwayTag = trip.sectorDefault === 'NORWAY'
            return (
              <article
                key={trip.id}
                className={`trip-card ${trip.colourTag} ${isPast ? 'is-past' : ''}`}
              >
                <div className="trip-stripe" aria-hidden="true" />
                <div className="trip-content">
                  <div className="trip-top">
                    <h3>{trip.title}</h3>
                    <span className={`badge ${trip.planned ? 'planned' : 'confirmed'}`}>
                      {trip.planned ? 'Planned' : 'Confirmed'}
                    </span>
                  </div>
                  <p className="trip-range">{formatRange(trip.startDayKey, trip.endDayKey)}</p>
                  <p className="trip-meta">
                    {tripTypeLabels[trip.tripType]} | {sectorLabels[trip.sectorDefault]}
                    {showUkTag ? <img className="meta-tag" src={Assets.tags.uk12nm} alt="" aria-hidden="true" /> : null}
                    {showNorwayTag ? <img className="meta-tag" src={Assets.tags.norway} alt="" aria-hidden="true" /> : null}
                  </p>
                  {trip.vessel ? <p className="trip-vessel">Vessel: {trip.vessel}</p> : null}
                  <div className="trip-actions">
                    <button type="button" className="trip-action-edit" onClick={() => openEditTrip(trip)}>
                      Edit Trip
                    </button>
                    <button type="button" className="trip-action-delete" onClick={() => handleDelete(trip.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            )
          })
        )}
      </section>

      {isModalOpen ? (
        <TripModal
          trip={editingTrip}
          seedType={seedType}
          overrides={state.overrides}
          saveWarning={saveWarning}
          onClose={closeModal}
          onSave={handleSave}
          tripDefaults={tripDefaults}
        />
      ) : null}

      {isTemplateOpen ? (
        <RotaTemplateModal
          onClose={handleTemplateClose}
          onSave={handleTemplateSave}
          defaultSector="UK_OUTSIDE_12NM"
        />
      ) : null}
    </div>
  )
}

export const tripUiUtils = {
  tripTypeLabels,
  sectorLabels,
}


