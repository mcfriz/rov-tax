import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { AppState, DayKey, Trip, TripType } from '../../data/types'
import { createTrip, toDayKey } from '../../data/helpers'
import { autoFindBestWindow, evaluateWindow } from '../../rules/sed_engine'
import { generateDayMap } from '../../rules/trip_engine'
import TripModal from '../trips/TripModal'

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

type Props = {
  state: AppState
  onChange: (next: AppState) => void
}

function calcConfidence(unknownDays: number, total = 365): number {
  const ratio = Math.max(0, Math.min(1, 1 - unknownDays / total))
  return Math.round(ratio * 100)
}

function getFixNeeded(ukMidnights: number, abroadMidnights: number): number {
  if (abroadMidnights > ukMidnights) {
    return 0
  }
  return ukMidnights - abroadMidnights + 1
}

function pickSuggestedRange(summary: ReturnType<typeof evaluateWindow>): { startDayKey: DayKey; endDayKey: DayKey } {
  if (summary.criticalRanges.length > 0) {
    return summary.criticalRanges[0]
  }
  const start = summary.endDayKey
  const [year, month, day] = start.split('-').map(Number)
  const end = toDayKey(new Date(year, month - 1, day + 6))
  return { startDayKey: start, endDayKey: end }
}

export default function OverviewTab({ state, onChange }: Props) {
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false)
  const dayMap = useMemo(() => generateDayMap(state.trips, state.overrides), [state.trips, state.overrides])

  const selectedStart = state.settings.selectedPeriodStart
  const anchorDate = state.selectedDate || toDayKey(new Date())

  const summary = useMemo(() => {
    if (selectedStart) {
      return evaluateWindow(selectedStart, 365, dayMap)
    }
    return autoFindBestWindow(anchorDate, 730, dayMap).summary
  }, [anchorDate, dayMap, selectedStart])

  const confidence = calcConfidence(summary.unknownDays)
  const fixNeeded = summary.status === 'FAILING' || summary.status === 'AT_RISK'
    ? getFixNeeded(summary.ukMidnights, summary.abroadMidnights)
    : 0

  const handlePeriodChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    onChange({
      ...state,
      settings: {
        ...state.settings,
        selectedPeriodStart: value || null,
      },
    })
  }

  const handleClearPeriod = () => {
    onChange({
      ...state,
      settings: {
        ...state.settings,
        selectedPeriodStart: null,
      },
    })
  }

  const handleHolidaySave = (draft: Omit<Trip, 'id' | 'createdAt' | 'updatedAt' | 'colourTag'> & { id?: string }) => {
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

    setIsHolidayModalOpen(false)
  }

  const suggestedRange = pickSuggestedRange(summary)

  return (
    <div className="page overview">
      <header className="page-header">
        <h2>Overview</h2>
        <p>Monitor SED eligibility and correct gaps early.</p>
      </header>

      <section className="card overview-period">
        <h3>Evaluated Period</h3>
        <p>
          {selectedStart
            ? `Selected window: ${summary.startDayKey} to ${summary.endDayKey}`
            : `Auto window: ${summary.startDayKey} to ${summary.endDayKey}`}
        </p>
        <label className="field">
          <span>Select period start</span>
          <input type="date" value={selectedStart ?? ''} onChange={handlePeriodChange} />
        </label>
        {selectedStart ? (
          <button type="button" className="ghost-button" onClick={handleClearPeriod}>
            Clear selection
          </button>
        ) : null}
      </section>

      <section className="card overview-stats">
        <h3>SED Summary</h3>
        <div className="overview-grid">
          <div>
            <span className="overview-label">Abroad midnights</span>
            <strong>{summary.abroadMidnights}</strong>
          </div>
          <div>
            <span className="overview-label">UK midnights</span>
            <strong>{summary.ukMidnights}</strong>
          </div>
          <div>
            <span className="overview-label">Unknown days</span>
            <strong>{summary.unknownDays}</strong>
          </div>
          <div>
            <span className="overview-label">Longest UK streak</span>
            <strong>{summary.longestConsecutiveUkStreak} days</strong>
          </div>
          <div>
            <span className="overview-label">Norway sector</span>
            <strong>{summary.norwayMidnights}</strong>
          </div>
          <div>
            <span className="overview-label">Inside 12nm UK</span>
            <strong>{summary.ukMidnights}</strong>
          </div>
        </div>

        <div className="confidence">
          <div className="confidence-header">
            <span>Confidence</span>
            <strong>{confidence}%</strong>
          </div>
          <div className="confidence-bar">
            <span style={{ width: `${confidence}%` }} />
          </div>
        </div>
      </section>

      {(summary.status === 'FAILING' || summary.status === 'AT_RISK') ? (
        <section className="card overview-fix">
          <h3>Fix Required</h3>
          <p>Need {fixNeeded} more abroad midnights to regain buffer.</p>
          <div className="critical-list">
            {summary.criticalRanges.length === 0 ? (
              <p>No critical ranges detected yet.</p>
            ) : (
              summary.criticalRanges.map((range) => (
                <div key={`${range.startDayKey}-${range.endDayKey}`} className="critical-item">
                  <strong>{range.startDayKey} to {range.endDayKey}</strong>
                  <span>Consider moving this block abroad.</span>
                </div>
              ))
            )}
          </div>
          <button type="button" className="primary-button" onClick={() => setIsHolidayModalOpen(true)}>
            Add Holiday Abroad
          </button>
        </section>
      ) : null}

      {isHolidayModalOpen ? (
        <TripModal
          trip={null}
          seedType="HOLIDAY_ABROAD"
          seedRange={suggestedRange}
          onClose={() => setIsHolidayModalOpen(false)}
          onSave={handleHolidaySave}
          tripDefaults={tripDefaults}
        />
      ) : null}
    </div>
  )
}
