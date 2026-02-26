import type { DayKey, DayOverride, DutyType, MidnightLocation } from '../../data/types'
import type { DerivedDay } from '../../rules/trip_engine'

const midnightOptions: Array<{ value: MidnightLocation; label: string }> = [
  { value: 'OUTSIDE_UK', label: 'Outside UK' },
  { value: 'INSIDE_12NM_UK', label: 'Inside 12nm UK' },
  { value: 'NORWAY_SECTOR', label: 'Norway Sector' },
  { value: 'UNKNOWN', label: 'Unknown' },
]

const dutyOptions: DutyType[] = ['OFFSHORE', 'LEAVE', 'TRANSIT', 'TRAINING', 'SICK', 'OTHER']

type Props = {
  dayKey: DayKey
  base?: DerivedDay
  override?: DayOverride
  onSave: (dayKey: DayKey, override: DayOverride | null) => void
}

function buildOverride(
  dayKey: DayKey,
  override: DayOverride | undefined,
  update: Partial<DayOverride>,
): DayOverride {
  return {
    dayKey,
    ...override,
    ...update,
    lastEdited: Date.now(),
  }
}

export default function DayOverrideEditor({ dayKey, base, override, onSave }: Props) {
  const currentMidnight = override?.midnightLocation ?? base?.midnightLocation ?? 'UNKNOWN'
  const currentDuty = override?.dutyType ?? base?.dutyType ?? 'OTHER'
  const currentCounts = override?.countsTowardSed ?? base?.countsTowardSed ?? false

  const handleClear = () => {
    onSave(dayKey, null)
  }

  return (
    <div className="override-editor">
      <label>
        Midnight Location
        <select
          value={override?.midnightLocation ?? ''}
          onChange={(event) => {
            const value = event.target.value
            const next = value ? (value as MidnightLocation) : undefined
            onSave(dayKey, buildOverride(dayKey, override, { midnightLocation: next }))
          }}
        >
          <option value="">Use trip default ({currentMidnight})</option>
          {midnightOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Duty Type
        <select
          value={override?.dutyType ?? ''}
          onChange={(event) => {
            const value = event.target.value
            const next = value ? (value as DutyType) : undefined
            onSave(dayKey, buildOverride(dayKey, override, { dutyType: next }))
          }}
        >
          <option value="">Use trip default ({currentDuty})</option>
          {dutyOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label>
        Counts Toward SED
        <select
          value={override?.countsTowardSed === undefined ? '' : override.countsTowardSed ? 'yes' : 'no'}
          onChange={(event) => {
            const value = event.target.value
            const next = value === '' ? undefined : value === 'yes'
            onSave(dayKey, buildOverride(dayKey, override, { countsTowardSed: next }))
          }}
        >
          <option value="">Use trip default ({currentCounts ? 'Yes' : 'No'})</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </label>

      <label>
        Vessel
        <input
          type="text"
          placeholder={base?.vessel ?? 'Optional'}
          value={override?.vessel ?? ''}
          onChange={(event) => {
            const value = event.target.value
            onSave(dayKey, buildOverride(dayKey, override, { vessel: value || undefined }))
          }}
        />
      </label>

      <label>
        Notes
        <textarea
          rows={3}
          value={override?.notes ?? ''}
          onChange={(event) => {
            const value = event.target.value
            onSave(dayKey, buildOverride(dayKey, override, { notes: value || undefined }))
          }}
        />
      </label>

      {override ? (
        <button type="button" className="ghost-button" onClick={handleClear}>
          Clear Override
        </button>
      ) : null}
    </div>
  )
}
