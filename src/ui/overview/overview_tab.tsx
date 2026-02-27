import { useMemo, useState } from 'react'
import type { ChangeEvent, Dispatch, SetStateAction } from 'react'
import type { AppState, DayKey, Trip, TripType } from '../../data/types'
import { createTrip, toDayKey } from '../../data/helpers'
import { autoFindBestWindow, evaluateWindow } from '../../rules/sed_engine'
import { generateDayMap } from '../../rules/trip_engine'
import TripModal, { type TripModalSavePayload } from '../trips/TripModal'

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
}

type Props = {
  state: AppState
  onChange: Dispatch<SetStateAction<AppState>>
}

function statusTone(status: string): string {
  if (status === 'QUALIFYING') return 'sed-good'
  if (status === 'AT_RISK') return 'sed-warn'
  if (status === 'FAILING') return 'sed-bad'
  return 'sed-unknown'
}

function statusPillClass(status: string): string {
  if (status === 'QUALIFYING') return 'is-good'
  if (status === 'AT_RISK') return 'is-warn'
  if (status === 'FAILING') return 'is-bad'
  return 'is-unknown'
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

  const confidence = summary.confidencePercent
  const fixNeeded = summary.fixNeededAbroadDays

  const handlePeriodChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    onChange((prev) => ({
      ...prev,
      selectedDate: value || prev.selectedDate,
      calendarZoom: value ? 'YEAR' : prev.calendarZoom,
      settings: {
        ...prev.settings,
        selectedPeriodStart: value || null,
      },
    }))
  }

  const handleClearPeriod = () => {
    onChange((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        selectedPeriodStart: null,
      },
    }))
  }

  const handleHolidaySave = (draft: TripModalSavePayload) => {
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

    onChange((prev) => ({
      ...prev,
      trips: [...prev.trips, nextTrip],
    }))

    setIsHolidayModalOpen(false)
  }

  const suggestedRange = pickSuggestedRange(summary)

  return (
    <div className="page overview">
      <header className="page-header">
        <h2>Overview</h2>
        <p>Monitor SED eligibility and correct gaps early.</p>
      </header>

      <section className={`sed-banner overview-sticky-bar ${statusTone(summary.status)}`}>
        <div className="sed-inline-head">
          <h3>SED: {summary.status.replace('_', ' ')}</h3>
          <span className="sed-inline-period">
            {selectedStart ? 'Manual' : 'Auto'} {summary.startDayKey} to {summary.endDayKey}
          </span>
        </div>
        <div className="sed-meta">
          <span>Abroad: {summary.abroadMidnights}</span>
          <span>UK: {summary.ukMidnights}</span>
        </div>
      </section>

      <section className="card overview-period">
        <div className="overview-card-head">
          <h3>Evaluated Period</h3>
          <span className="overview-mode-pill">{selectedStart ? 'Manual' : 'Auto'}</span>
        </div>
        <p className="overview-period-range">
          {summary.startDayKey} to {summary.endDayKey}
        </p>
        <div className="overview-period-controls">
          <label className="overview-input-group">
            <span>Period Start (365 days)</span>
            <input type="date" value={selectedStart ?? ''} onChange={handlePeriodChange} />
          </label>
          <div className="overview-period-actions">
            {selectedStart ? (
              <button type="button" className="ghost-button" onClick={handleClearPeriod}>
                Clear Selection
              </button>
            ) : (
              <span className="overview-hint-chip">Using best auto period</span>
            )}
          </div>
        </div>
      </section>

      <section className="card overview-stats">
        <div className="overview-card-head">
          <h3>SED Summary</h3>
          <span className={`overview-status-pill ${statusPillClass(summary.status)}`}>{summary.status.replace('_', ' ')}</span>
        </div>
        <div className="overview-metrics">
          <div className="overview-metric">
            <span className="overview-label">Abroad Midnights</span>
            <strong>{summary.abroadMidnights}</strong>
          </div>
          <div className="overview-metric">
            <span className="overview-label">UK Midnights</span>
            <strong>{summary.ukMidnights}</strong>
          </div>
          <div className="overview-metric">
            <span className="overview-label">Unknown Days</span>
            <strong>{summary.unknownDays}</strong>
          </div>
          <div className="overview-metric">
            <span className="overview-label">Longest UK Streak</span>
            <strong>{summary.longestConsecutiveUkStreak} days</strong>
          </div>
          <div className="overview-metric">
            <span className="overview-label">Norway Sector</span>
            <strong>{summary.norwayMidnights}</strong>
          </div>
          <div className="overview-metric">
            <span className="overview-label">Inside 12nm UK</span>
            <strong>{summary.inside12NmTripTaggedDays}</strong>
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
          <p className="confidence-copy">
            Higher confidence means fewer unknown days in the selected 365-day window.
          </p>
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
          overrides={state.overrides}
          onClose={() => setIsHolidayModalOpen(false)}
          onSave={handleHolidaySave}
          tripDefaults={tripDefaults}
        />
      ) : null}
    </div>
  )
}
