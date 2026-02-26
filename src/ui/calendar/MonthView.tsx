import { useMemo, useRef, useState } from 'react'
import type { AppState, DayKey, DayOverride, DutyType, MidnightLocation } from '../../data/types'
import type { DerivedDay } from '../../rules/trip_engine'
import { buildMonthDays, getDayStatus, getMonthTint, getTripStrip, parseDayKey } from './calendar_helpers'

type Props = {
  dayMap: Record<DayKey, DerivedDay>
  selectedDayKey: DayKey
  onSelectDay: (dayKey: DayKey) => void
  state: AppState
  onChange: (next: AppState) => void
}

const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const midnightOptions: Array<{ value: MidnightLocation; label: string }> = [
  { value: 'OUTSIDE_UK', label: 'Outside UK' },
  { value: 'INSIDE_12NM_UK', label: 'Inside 12nm UK' },
  { value: 'NORWAY_SECTOR', label: 'Norway Sector' },
  { value: 'UNKNOWN', label: 'Unknown' },
]

const dutyOptions: DutyType[] = ['OFFSHORE', 'LEAVE', 'TRANSIT', 'TRAINING', 'SICK', 'OTHER']

function getMonthTitle(dayKey: DayKey): string {
  const date = parseDayKey(dayKey)
  return `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`
}

export default function MonthView({ dayMap, selectedDayKey, onSelectDay, state, onChange }: Props) {
  const date = useMemo(() => parseDayKey(selectedDayKey), [selectedDayKey])
  const year = date.getFullYear()
  const monthIndex = date.getMonth()
  const days = useMemo(() => buildMonthDays(year, monthIndex), [year, monthIndex])

  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedDays, setSelectedDays] = useState<Set<DayKey>>(new Set())
  const [bulkMidnight, setBulkMidnight] = useState<MidnightLocation | ''>('')
  const [bulkDuty, setBulkDuty] = useState<DutyType | ''>('')
  const [bulkCounts, setBulkCounts] = useState<'yes' | 'no' | ''>('')
  const [bulkVessel, setBulkVessel] = useState('')

  const longPressTimer = useRef<number | null>(null)
  const longPressTriggered = useRef(false)

  const monthDerived = useMemo(
    () =>
      Object.values(dayMap).filter((day) => {
        const dayDate = parseDayKey(day.dayKey)
        return dayDate.getFullYear() === year && dayDate.getMonth() === monthIndex
      }),
    [dayMap, monthIndex, year],
  )

  const tint = getMonthTint(monthDerived)

  const clearTimer = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const resetBulk = () => {
    setBulkMidnight('')
    setBulkDuty('')
    setBulkCounts('')
    setBulkVessel('')
  }

  const exitSelectMode = () => {
    setIsSelectMode(false)
    setSelectedDays(new Set())
    resetBulk()
  }

  const handleLongPress = (dayKey: DayKey) => {
    clearTimer()
    longPressTriggered.current = false
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true
      setIsSelectMode(true)
      setSelectedDays(new Set([dayKey]))
    }, 450)
  }

  const handlePointerUp = () => {
    clearTimer()
  }

  const toggleDay = (dayKey: DayKey) => {
    setSelectedDays((prev) => {
      const next = new Set(prev)
      if (next.has(dayKey)) {
        next.delete(dayKey)
      } else {
        next.add(dayKey)
      }
      return next
    })
  }

  const handleDayClick = (dayKey: DayKey) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false
      return
    }
    if (isSelectMode) {
      toggleDay(dayKey)
      return
    }
    onSelectDay(dayKey)
  }

  const applyBulk = () => {
    if (selectedDays.size === 0) {
      return
    }

    const nextOverrides: Record<DayKey, DayOverride> = { ...state.overrides }
    selectedDays.forEach((dayKey) => {
      const base = dayMap[dayKey]
      const existing = nextOverrides[dayKey]
      const updated: DayOverride = {
        dayKey,
        midnightLocation: bulkMidnight !== '' ? bulkMidnight : existing?.midnightLocation ?? base?.midnightLocation,
        dutyType: bulkDuty !== '' ? bulkDuty : existing?.dutyType ?? base?.dutyType,
        countsTowardSed:
          bulkCounts !== ''
            ? bulkCounts === 'yes'
            : existing?.countsTowardSed ?? base?.countsTowardSed,
        vessel: bulkVessel !== '' ? bulkVessel : existing?.vessel ?? base?.vessel,
        notes: existing?.notes ?? base?.notes,
        lastEdited: Date.now(),
      }

      nextOverrides[dayKey] = updated
    })

    onChange({
      ...state,
      overrides: nextOverrides,
    })
    exitSelectMode()
  }

  const clearBulkOverrides = () => {
    if (selectedDays.size === 0) {
      return
    }
    const nextOverrides = { ...state.overrides }
    selectedDays.forEach((dayKey) => {
      delete nextOverrides[dayKey]
    })
    onChange({
      ...state,
      overrides: nextOverrides,
    })
    exitSelectMode()
  }

  return (
    <div className={`month-view ${tint}`}>
      <div className="month-header">
        <h3>{getMonthTitle(selectedDayKey)}</h3>
        {isSelectMode ? <span className="badge planned">Bulk Select</span> : null}
      </div>

      {isSelectMode ? (
        <section className="card bulk-panel">
          <div className="bulk-header">
            <h4>{selectedDays.size} days selected</h4>
            <button type="button" className="ghost-button" onClick={exitSelectMode}>
              Cancel
            </button>
          </div>
          <div className="bulk-grid">
            <label>
              Midnight Location
              <select value={bulkMidnight} onChange={(event) => setBulkMidnight(event.target.value as MidnightLocation | '')}>
                <option value="">No change</option>
                {midnightOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Duty Type
              <select value={bulkDuty} onChange={(event) => setBulkDuty(event.target.value as DutyType | '')}>
                <option value="">No change</option>
                {dutyOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Counts Toward SED
              <select value={bulkCounts} onChange={(event) => setBulkCounts(event.target.value as 'yes' | 'no' | '')}>
                <option value="">No change</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
            <label>
              Vessel
              <input type="text" value={bulkVessel} onChange={(event) => setBulkVessel(event.target.value)} />
            </label>
          </div>
          <div className="bulk-actions">
            <button type="button" className="primary-button" onClick={applyBulk}>
              Apply Overrides
            </button>
            <button type="button" className="ghost-button" onClick={clearBulkOverrides}>
              Clear Overrides
            </button>
          </div>
        </section>
      ) : null}

      <div className="weekday-row">
        {weekdayLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="month-grid">
        {days.map((dayKey, idx) => {
          if (!dayKey) {
            return <div key={`empty-${idx}`} className="day-cell empty" />
          }
          const derived = dayMap[dayKey]
          const status = getDayStatus(derived)
          const strip = getTripStrip(derived?.tripType ?? null)
          const isSelected = selectedDays.has(dayKey)

          return (
            <button
              key={dayKey}
              type="button"
              className={`day-cell ${status} ${isSelected ? 'is-selected' : ''}`}
              onClick={() => handleDayClick(dayKey)}
              onPointerDown={() => handleLongPress(dayKey)}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              <span className={`trip-strip ${strip}`} aria-hidden="true" />
              <span className="day-number">{Number(dayKey.split('-')[2])}</span>
              <span className={`day-dot ${status}`} />
            </button>
          )}
        )}
      </div>
    </div>
  )
}