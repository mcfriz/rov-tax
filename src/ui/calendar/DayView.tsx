import type { AppState, DayKey, DayOverride } from '../../data/types'
import type { DerivedDay } from '../../rules/trip_engine'
import DayOverrideEditor from './DayOverrideEditor'

const tripLabels: Record<string, string> = {
  OFFSHORE_WORK: 'Offshore Work',
  UK_HOME: 'UK Home',
  HOLIDAY_ABROAD: 'Holiday Abroad',
  TRAINING_ABROAD: 'Training Abroad',
  TRANSIT: 'Transit',
  UK_WATERS_WORK: 'UK Waters Work',
}

type Props = {
  dayMap: Record<DayKey, DerivedDay>
  selectedDayKey: DayKey
  state: AppState
  onChange: (next: AppState) => void
}

export default function DayView({ dayMap, selectedDayKey, state, onChange }: Props) {
  const derived = dayMap[selectedDayKey]
  const override = state.overrides[selectedDayKey]

  const handleSave = (dayKey: DayKey, nextOverride: DayOverride | null) => {
    const nextOverrides = { ...state.overrides }
    if (!nextOverride) {
      delete nextOverrides[dayKey]
    } else {
      nextOverrides[dayKey] = nextOverride
    }

    onChange({
      ...state,
      overrides: nextOverrides,
    })
  }

  return (
    <div className="day-view">
      <div className="day-header">
        <div>
          <h3>{selectedDayKey}</h3>
          <p>{derived?.tripType ? tripLabels[derived.tripType] : 'No trip'}</p>
        </div>
        {override ? <span className="badge planned">Override</span> : null}
      </div>

      <section className="card">
        <h4>Derived Values</h4>
        <ul className="derived-list">
          <li>Midnight: {derived?.midnightLocation ?? 'UNKNOWN'}</li>
          <li>Duty: {derived?.dutyType ?? 'OTHER'}</li>
          <li>SED: {derived?.countsTowardSed ? 'Yes' : 'No'}</li>
          <li>Vessel: {derived?.vessel ?? '—'}</li>
          <li>Notes: {derived?.notes ?? '—'}</li>
          <li>Trip: {derived?.tripType ?? '—'}</li>
        </ul>
      </section>

      <section className="card">
        <h4>Override</h4>
        <p className="hint">Changes save instantly for this day.</p>
        <DayOverrideEditor dayKey={selectedDayKey} base={derived} override={override} onSave={handleSave} />
      </section>
    </div>
  )
}