import type { AppState, DayKey, DayOverride } from '../../data/types'
import type { DerivedDay } from '../../rules/trip_engine'
import type { Dispatch, SetStateAction } from 'react'
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

type Props = {
  dayMap: Record<DayKey, DerivedDay>
  selectedDayKey: DayKey
  state: AppState
  onChange: Dispatch<SetStateAction<AppState>>
}

export default function DayView({ dayMap, selectedDayKey, state, onChange }: Props) {
  const derived = dayMap[selectedDayKey]
  const override = state.overrides[selectedDayKey]
  const isUk = derived?.midnightLocation === 'INSIDE_12NM_UK'
  const isNorway = derived?.midnightLocation === 'NORWAY_SECTOR'

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
          <li className="derived-item">
            <span>Midnight: {derived?.midnightLocation ?? 'UNKNOWN'}</span>
            {isUk ? <img className="tag-icon" src={Assets.tags.uk12nm} alt="" aria-hidden="true" /> : null}
            {isNorway ? <img className="tag-icon" src={Assets.tags.norway} alt="" aria-hidden="true" /> : null}
          </li>
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
