import { useMemo, useState } from 'react'
import type { AppState, DayKey, SectorDefault, Trip, TripType } from '../../data/types'
import type { Dispatch, SetStateAction } from 'react'
import { createTrip, deriveTripColour, nowIso, toDayKey } from '../../data/helpers'
import TripModal from './TripModal'
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

const quickAddTypes: TripType[] = ['OFFSHORE_WORK', 'HOLIDAY_ABROAD']
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
  if (sectorDefault === 'UK_INSIDE_12NM') {
    return false
  }
  if (tripType === 'UK_HOME') {
    return false
  }
  return true
}

export default function TripsTab({ state, onChange }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isTemplateOpen, setIsTemplateOpen] = useState(false)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [seedType, setSeedType] = useState<TripType | null>(null)
  const [generationSummary, setGenerationSummary] = useState<string | null>(null)

  const sortedTrips = useMemo(() => {
    return [...state.trips].sort((a, b) => a.startDayKey.localeCompare(b.startDayKey))
  }, [state.trips])

  const todayKey = toDayKey(new Date())

  const openNewTrip = (tripType?: TripType) => {
    setSeedType(tripType ?? null)
    setEditingTrip(null)
    setIsModalOpen(true)
  }

  const openEditTrip = (trip: Trip) => {
    setEditingTrip(trip)
    setSeedType(null)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingTrip(null)
    setSeedType(null)
  }

  const handleSave = (draft: Omit<Trip, 'id' | 'createdAt' | 'updatedAt' | 'colourTag'> & { id?: string }) => {
    if (editingTrip) {
      onChange((prev) => ({
        ...prev,
        trips: prev.trips.map((trip) => {
          if (trip.id !== editingTrip.id) {
            return trip
          }

          return {
            ...trip,
            ...draft,
            id: trip.id,
            planned: trip.planned,
            countsTowardSedDefault: defaultCountsTowardSed(draft.tripType, draft.sectorDefault),
            updatedAt: nowIso(),
            colourTag: deriveTripColour(draft.tripType),
          }
        }),
      }))
    } else {
      const nextTrip = createTrip({
        title: draft.title,
        tripType: draft.tripType,
        startDayKey: draft.startDayKey,
        endDayKey: draft.endDayKey,
        vessel: draft.vessel || undefined,
        sectorDefault: draft.sectorDefault,
        dutyDefault: draft.dutyDefault,
        countsTowardSedDefault: defaultCountsTowardSed(draft.tripType, draft.sectorDefault),
        planned: false,
      })

      onChange((prev) => ({
        ...prev,
        trips: [...prev.trips, nextTrip],
      }))
    }

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
        <div className="quick-add">
          <span>Quick Add</span>
          {quickAddTypes.map((type) => (
            <button key={type} type="button" onClick={() => openNewTrip(type)}>
              {tripTypeLabels[type].split(' ')[0]}
            </button>
          ))}
        </div>
      </section>

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
                    {tripTypeLabels[trip.tripType]} · {sectorLabels[trip.sectorDefault]}
                    {showUkTag ? <img className="meta-tag" src={Assets.tags.uk12nm} alt="" aria-hidden="true" /> : null}
                    {showNorwayTag ? <img className="meta-tag" src={Assets.tags.norway} alt="" aria-hidden="true" /> : null}
                  </p>
                  {trip.vessel ? <p className="trip-vessel">Vessel: {trip.vessel}</p> : null}
                </div>
                <div className="trip-actions">
                  <button type="button" onClick={() => openEditTrip(trip)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => handleDelete(trip.id)}>
                    Delete
                  </button>
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
