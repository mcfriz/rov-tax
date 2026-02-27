import { useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { AppState, DayKey, DayOverride, DutyType, MidnightLocation, TripType } from '../../data/types'
import type { DerivedDay } from '../../rules/trip_engine'
import {
  buildMonthDays,
  getDayStatus,
  getMonthTint,
  getTripStrip,
  isDayInWindow,
  parseDayKey,
  type DayStatus,
} from './calendar_helpers'
import { Assets } from '../common/assets'
import { toDayKey } from '../../data/helpers'

type Props = {
  dayMap: Record<DayKey, DerivedDay>
  selectedDayKey: DayKey
  onSelectDay: (dayKey: DayKey) => void
  onNavigateMonth: (deltaMonths: number) => void
  onJumpToday: () => void
  windowStartDayKey: DayKey
  windowEndDayKey: DayKey
  onChange: Dispatch<SetStateAction<AppState>>
}

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const midnightOptions: Array<{ value: MidnightLocation; label: string }> = [
  { value: 'OUTSIDE_UK', label: 'Outside UK' },
  { value: 'INSIDE_12NM_UK', label: 'Inside 12nm UK' },
  { value: 'NORWAY_SECTOR', label: 'Norway Sector' },
  { value: 'UNKNOWN', label: 'Unknown' },
]

const dutyOptions: DutyType[] = ['OFFSHORE', 'LEAVE', 'TRANSIT', 'TRAINING', 'SICK', 'OTHER']

const statusToAsset: Record<DayStatus, string> = {
  qualifying: Assets.statusDots.qualifying,
  'at-risk': Assets.statusDots.atRisk,
  non: Assets.statusDots.nonQualifying,
  unknown: Assets.statusDots.unknown,
}

const statusLabels: Record<DayStatus, string> = {
  qualifying: 'Qualifying',
  'at-risk': 'At risk',
  non: 'Non qualifying',
  unknown: 'Unknown',
}

const tripTypeLabels: Record<TripType, string> = {
  OFFSHORE_WORK: 'Offshore',
  UK_HOME: 'Home',
  HOLIDAY_ABROAD: 'Holiday',
  TRAINING_ABROAD: 'Training',
  TRANSIT: 'Transit',
  UK_WATERS_WORK: 'UK waters',
}

const locationLabels: Record<MidnightLocation, string> = {
  OUTSIDE_UK: 'Outside UK',
  INSIDE_12NM_UK: 'Inside 12nm',
  NORWAY_SECTOR: 'Norway',
  UNKNOWN: 'Unknown',
}

function getMonthTitle(dayKey: DayKey): string {
  const date = parseDayKey(dayKey)
  return `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`
}

export default function MonthView({
  dayMap,
  selectedDayKey,
  onSelectDay,
  onNavigateMonth,
  onJumpToday,
  windowStartDayKey,
  windowEndDayKey,
  onChange,
}: Props) {
  const date = useMemo(() => parseDayKey(selectedDayKey), [selectedDayKey])
  const year = date.getFullYear()
  const monthIndex = date.getMonth()
  const days = useMemo(() => buildMonthDays(year, monthIndex), [year, monthIndex])
  const todayKey = toDayKey(new Date())

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

  const monthStats = useMemo(() => {
    const trackedDays = monthDerived.filter((day) => day.tripType !== null).length
    const qualifyingDays = monthDerived.filter((day) => day.countsTowardSed).length
    return { trackedDays, qualifyingDays }
  }, [monthDerived])

  const windowDaysInMonth = useMemo(
    () =>
      days.reduce(
        (count, dayKey) =>
          dayKey && isDayInWindow(dayKey, windowStartDayKey, windowEndDayKey) ? count + 1 : count,
        0,
      ),
    [days, windowEndDayKey, windowStartDayKey],
  )

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

    onChange((prev) => ({
      ...prev,
      overrides: (() => {
        const nextOverrides: Record<DayKey, DayOverride> = { ...prev.overrides }
        selectedDays.forEach((dayKey) => {
          const base = dayMap[dayKey]
          const existing = nextOverrides[dayKey]
          const updated: DayOverride = {
            dayKey,
            midnightLocation: bulkMidnight !== '' ? bulkMidnight : existing?.midnightLocation ?? base?.midnightLocation,
            dutyType: bulkDuty !== '' ? bulkDuty : existing?.dutyType ?? base?.dutyType,
            countsTowardSed:
              bulkCounts !== '' ? bulkCounts === 'yes' : existing?.countsTowardSed ?? base?.countsTowardSed,
            vessel: bulkVessel !== '' ? bulkVessel : existing?.vessel ?? base?.vessel,
            notes: existing?.notes ?? base?.notes,
            lastEdited: Date.now(),
          }
          nextOverrides[dayKey] = updated
        })
        return nextOverrides
      })(),
    }))

    exitSelectMode()
  }

  const clearBulkOverrides = () => {
    if (selectedDays.size === 0) {
      return
    }

    onChange((prev) => ({
      ...prev,
      overrides: (() => {
        const nextOverrides = { ...prev.overrides }
        selectedDays.forEach((dayKey) => {
          delete nextOverrides[dayKey]
        })
        return nextOverrides
      })(),
    }))

    exitSelectMode()
  }

  return (
    <div className={`month-view ${tint}`}>
      <div className="month-header">
        <div className="month-header-main">
          <div>
            <h3>{getMonthTitle(selectedDayKey)}</h3>
            <p className="month-summary">
              {monthStats.trackedDays} tracked | {monthStats.qualifyingDays} qualifying | {windowDaysInMonth} in SED period
            </p>
          </div>
          {!isSelectMode ? (
            <button type="button" className="ghost-button month-today-btn" onClick={onJumpToday}>
              Today
            </button>
          ) : null}
        </div>
        <div className="month-nav">
          <button
            type="button"
            className="icon-button month-nav-btn"
            onClick={() => onNavigateMonth(-1)}
            aria-label="Previous month"
          >
            {'<'}
          </button>
          <button
            type="button"
            className="icon-button month-nav-btn"
            onClick={() => onNavigateMonth(1)}
            aria-label="Next month"
          >
            {'>'}
          </button>
          {isSelectMode ? <span className="badge planned">Bulk Select</span> : null}
        </div>
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
          const isFocusedDay = dayKey === selectedDayKey
          const isToday = dayKey === todayKey
          const inWindow = isDayInWindow(dayKey, windowStartDayKey, windowEndDayKey)
          const isUk = derived?.midnightLocation === 'INSIDE_12NM_UK'
          const isNorway = derived?.midnightLocation === 'NORWAY_SECTOR'
          const tripLabel = derived?.tripType ? tripTypeLabels[derived.tripType] : 'No record'
          const locationLabel = derived ? locationLabels[derived.midnightLocation] : 'No data'

          return (
            <button
              key={dayKey}
              type="button"
              className={`day-cell ${status} ${inWindow ? 'in-window' : ''} ${isSelected ? 'is-selected' : ''} ${isFocusedDay ? 'is-focused' : ''} ${isToday ? 'is-today' : ''}`}
              onClick={() => handleDayClick(dayKey)}
              onPointerDown={() => handleLongPress(dayKey)}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              aria-label={`${dayKey}, ${tripLabel}, ${statusLabels[status]}`}
            >
              <span className={`trip-strip ${strip}`} aria-hidden="true" />
              <div className="day-cell-head">
                <span className="day-number-row">
                  <span className="day-number">{Number(dayKey.split('-')[2])}</span>
                  {isToday ? <span className="day-today-pill">Today</span> : null}
                </span>
                <img className="status-dot" src={statusToAsset[status]} alt="" aria-hidden="true" />
              </div>

              <span className={`day-primary ${derived?.tripType ? '' : 'is-empty'}`}>{tripLabel}</span>
              <span className="day-secondary">{locationLabel}</span>

              <div className="day-foot">
                <div className="day-tags">
                  {isUk ? <img className="day-tag" src={Assets.tags.uk12nm} alt="" aria-hidden="true" /> : null}
                  {isNorway ? <img className="day-tag" src={Assets.tags.norway} alt="" aria-hidden="true" /> : null}
                </div>
                {derived?.isOverride ? <span className="day-override-pill">Override</span> : null}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
