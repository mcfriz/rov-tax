import { useMemo, useState } from 'react'
import type { AppState, DayKey, SectorDefault, Trip, TripType } from '../../data/types'
import { createTrip, deriveTripColour, nowIso, toDayKey } from '../../data/helpers'
import TripModal from './TripModal'
import RotaTemplateModal from './RotaTemplateModal'
import { generateRotaTrips } from '../../rules/rota_generator'

const tripTypeLabels: Record<TripType, string> = {
  OFFSHORE_WORK: 'Offshore Work',
  UK_HOME: 'UK Home',
  HOLIDAY_ABROAD: 'Holiday Abroad',
  TRAINING_ABROAD: 'Training Abroad',
  TRANSIT: 'Transit',
  UK_WATERS_WORK: 'UK Waters Work',
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
  UK_HOME: {
    sectorDefault: 'OTHER',
    dutyDefault: 'LEAVE',
    countsTowardSedDefault: false,
  },
  HOLIDAY_ABROAD: {
    sectorDefault: 'OTHER',
    dutyDefault: 'LEAVE',
    countsTowardSedDefault: false,
  },
  TRAINING_ABROAD: {
    sectorDefault: 'OTHER',
    dutyDefault: 'TRAINING',
    countsTowardSedDefault: false,
  },
  TRANSIT: {
    sectorDefault: 'OTHER',
    dutyDefault: 'TRANSIT',
    countsTowardSedDefault: false,
  },
  UK_WATERS_WORK: {
    sectorDefault: 'UK_INSIDE_12NM',
    dutyDefault: 'OFFSHORE',
    countsTowardSedDefault: false,
  },
}

const quickAddTypes: TripType[] = ['OFFSHORE_WORK', 'UK_HOME', 'HOLIDAY_ABROAD']

type Props = {
  state: AppState
  onChange: (next: AppState) => void
}

function formatRange(startDayKey: DayKey, endDayKey: DayKey): string {
  if (startDayKey === endDayKey) {
    return startDayKey
  }
  return `${startDayKey} ? ${endDayKey}`
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
      const nextTrips = state.trips.map((trip) => {
        if (trip.id !== editingTrip.id) {
          return trip
        }

        return {
          ...trip,
          ...draft,
          id: trip.id,
          updatedAt: nowIso(),
          colourTag: deriveTripColour(draft.tripType),
        }
      })

      onChange({
        ...state,
        trips: nextTrips,
      })
    } else {
      const nextTrip = createTrip({
        title: draft.title,
        tripType: draft.tripType,
        startDayKey: draft.startDayKey,
        endDayKey: draft.endDayKey,
        vessel: draft.vessel || undefined,
        sectorDefault: draft.sectorDefault,
        dutyDefault: draft.dutyDefault,
        countsTowardSedDefault: draft.countsTowardSedDefault,
        planned: draft.planned,
      })

      onChange({
        ...state,
        trips: [...state.trips, nextTrip],
      })
    }

    closeModal()
  }

  const handleDelete = (tripId: string) => {
    const nextTrips = state.trips.filter((trip) => trip.id !== tripId)
    onChange({
      ...state,
      trips: nextTrips,
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
      onChange({
        ...state,
        trips: [...state.trips, ...result.plannedTrips],
      })
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
          Add Rota Template
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
          <div className="card">
            <h3>No trips yet</h3>
            <p>Add a trip or use a rota template to get started.</p>
          </div>
        ) : (
          sortedTrips.map((trip) => {
            const isPast = trip.endDayKey < todayKey
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
