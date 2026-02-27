import type { Dispatch, SetStateAction } from 'react'
import type { AppState, DayKey, DayOverride } from '../../data/types'
import type { DerivedDay } from '../../rules/trip_engine'
import { getDayStatus, parseDayKey } from './calendar_helpers'
import DayOverrideEditor from './DayOverrideEditor'
import { Assets } from '../common/assets'

const tripLabels: Record<string, string> = {
  OFFSHORE_WORK: 'Offshore Work',
  UK_HOME: 'UK Home',
  HOLIDAY_ABROAD: 'Holiday Abroad',
  TRAINING_ABROAD: 'Training Abroad',
  TRANSIT: 'Transit',
  UK_WATERS_WORK: 'UK Waters Work',
}

const midnightLabels: Record<string, string> = {
  OUTSIDE_UK: 'Outside UK',
  INSIDE_12NM_UK: 'Inside 12nm UK',
  NORWAY_SECTOR: 'Norway sector',
  UNKNOWN: 'Unknown',
}

const dutyLabels: Record<string, string> = {
  OFFSHORE: 'Offshore',
  LEAVE: 'Leave',
  TRANSIT: 'Transit',
  TRAINING: 'Training',
  SICK: 'Sick',
  OTHER: 'Other',
}

const statusLabels: Record<string, string> = {
  qualifying: 'Qualifying',
  'at-risk': 'At Risk',
  non: 'Non Qualifying',
  unknown: 'Unknown',
}

type Props = {
  dayMap: Record<DayKey, DerivedDay>
  selectedDayKey: DayKey
  state: AppState
  onChange: Dispatch<SetStateAction<AppState>>
}

function formatLongDate(dayKey: DayKey): string {
  const date = parseDayKey(dayKey)
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function getSedReason(day: DerivedDay | undefined): string {
  if (!day || !day.tripType) {
    return 'No trip data for this date.'
  }

  if (day.midnightLocation === 'INSIDE_12NM_UK') {
    return 'Inside UK 12nm, counted as a UK day.'
  }

  if (day.countsTowardSed) {
    return 'Counts toward SED.'
  }

  return 'Currently non-qualifying for SED.'
}

function getSourceLabel(day: DerivedDay | undefined): string {
  if (!day) {
    return 'No source'
  }
  if (day.isOverride) {
    return 'Manual override'
  }
  if (day.tripType === 'UK_HOME') {
    return 'Auto-filled home gap'
  }
  if (day.sourceTripId) {
    return day.isPlanned ? 'Planned trip' : 'Confirmed trip'
  }
  return 'Derived default'
}

export default function DayView({ dayMap, selectedDayKey, state, onChange }: Props) {
  const derived = dayMap[selectedDayKey]
  const override = state.overrides[selectedDayKey]
  const status = getDayStatus(derived)

  const handleSave = (dayKey: DayKey, nextOverride: DayOverride | null) => {
    onChange((prev) => ({
      ...prev,
      overrides: (() => {
        const nextOverrides = { ...prev.overrides }
        if (!nextOverride) {
          delete nextOverrides[dayKey]
        } else {
          nextOverrides[dayKey] = nextOverride
        }
        return nextOverrides
      })(),
    }))
  }

  const midnightLabel = midnightLabels[derived?.midnightLocation ?? 'UNKNOWN']
  const dutyLabel = dutyLabels[derived?.dutyType ?? 'OTHER']
  const tripLabel = derived?.tripType ? tripLabels[derived.tripType] : 'No trip recorded'
  const hasUkTag = derived?.midnightLocation === 'INSIDE_12NM_UK'
  const hasNorwayTag = derived?.midnightLocation === 'NORWAY_SECTOR'

  return (
    <div className="day-view">
      <section className="card day-card day-summary-card">
        <div className="day-summary-top">
          <div>
            <p className="day-date-label">{formatLongDate(selectedDayKey)}</p>
            <h3>{tripLabel}</h3>
            <p className="day-summary-copy">{getSedReason(derived)}</p>
          </div>
          <div className="day-summary-badges">
            <span className={`badge day-status-badge ${status}`}>{statusLabels[status]}</span>
            {override ? <span className="badge planned">Override</span> : null}
            {derived?.conflict ? <span className="badge non-qualifying">Conflict</span> : null}
          </div>
        </div>
      </section>

      <section className="card day-card day-facts">
        <div className="day-section-head">
          <h4>Snapshot</h4>
          <span className="day-section-subtitle">Used in SED</span>
        </div>
        <div className="day-fact-grid">
          <div className="day-fact day-fact-compact">
            <span className="day-fact-label">Midnight</span>
            <div className="day-fact-value-row">
              <strong>{midnightLabel}</strong>
            </div>
            <div className="day-fact-tags" aria-hidden="true">
              {hasUkTag ? <img className="tag-icon" src={Assets.tags.uk12nm} alt="" /> : null}
              {hasNorwayTag ? <img className="tag-icon" src={Assets.tags.norway} alt="" /> : null}
            </div>
          </div>
          <div className="day-fact day-fact-compact">
            <span className="day-fact-label">Duty</span>
            <strong>{dutyLabel}</strong>
          </div>
          <div className="day-fact day-fact-compact">
            <span className="day-fact-label">SED</span>
            <strong>{derived?.countsTowardSed ? 'Yes' : 'No'}</strong>
          </div>
          <div className="day-fact day-fact-compact">
            <span className="day-fact-label">Vessel</span>
            <strong>{derived?.vessel || '-'}</strong>
          </div>
          <div className="day-fact day-fact-compact">
            <span className="day-fact-label">Source</span>
            <strong>{getSourceLabel(derived)}</strong>
          </div>
          <div className="day-fact day-fact-compact">
            <span className="day-fact-label">Notes</span>
            <strong>{derived?.notes || '-'}</strong>
          </div>
        </div>
      </section>

      <section className="card day-card">
        <h4>Override</h4>
        <p className="hint day-override-hint">Override only for exceptions. Changes save instantly.</p>
        <DayOverrideEditor dayKey={selectedDayKey} base={derived} override={override} onSave={handleSave} />
      </section>
    </div>
  )
}
