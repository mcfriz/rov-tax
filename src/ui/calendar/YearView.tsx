import { useEffect, useRef } from 'react'
import type { DayKey } from '../../data/types'
import type { DerivedDay } from '../../rules/trip_engine'
import { buildMonthDays, formatDayKey, getDayStatus, isDayInWindow, parseDayKey } from './calendar_helpers'
import { Assets } from '../common/assets'

type Props = {
  dayMap: Record<DayKey, DerivedDay>
  onSelectMonth: (dayKey: DayKey) => void
  windowStartDayKey: DayKey
  windowEndDayKey: DayKey
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const statusToAsset: Record<string, string> = {
  qualifying: Assets.statusDots.qualifying,
  'at-risk': Assets.statusDots.atRisk,
  non: Assets.statusDots.nonQualifying,
  unknown: Assets.statusDots.unknown,
}

function hasMonthWindowDays(days: Array<DayKey | null>, startDayKey: DayKey, endDayKey: DayKey): boolean {
  return days.some((dayKey) => dayKey && isDayInWindow(dayKey, startDayKey, endDayKey))
}

export default function YearView({ dayMap, onSelectMonth, windowStartDayKey, windowEndDayKey }: Props) {
  const currentYear = new Date().getFullYear()
  const tripYears = Object.values(dayMap)
    .filter((day) => Boolean(day.sourceTripId))
    .map((day) => parseDayKey(day.dayKey).getFullYear())
    .sort((a, b) => a - b)

  const years =
    tripYears.length === 0
      ? [currentYear]
      : tripYears[0] === tripYears[tripYears.length - 1]
        ? [tripYears[0]]
        : [tripYears[0], tripYears[tripYears.length - 1]]
  const currentYearRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!currentYearRef.current) {
      return
    }
    currentYearRef.current.scrollIntoView({ block: 'start' })
  }, [])

  return (
    <div className="year-view">
      {years.map((year) => (
        <section
          key={year}
          className={`year-block ${year === currentYear ? 'is-current-year' : ''}`}
          ref={year === currentYear ? currentYearRef : undefined}
        >
          <h3>{year}</h3>
          <div className="year-months">
            {monthNames.map((monthLabel, monthIndex) => {
              const days = buildMonthDays(year, monthIndex)
              const monthStart = formatDayKey(new Date(year, monthIndex, 1))
              const inSedPeriod = hasMonthWindowDays(days, windowStartDayKey, windowEndDayKey)

              return (
                <button
                  key={`${year}-${monthLabel}`}
                  type="button"
                  className={`mini-month ${inSedPeriod ? 'in-period' : ''}`}
                  onClick={() => onSelectMonth(monthStart)}
                >
                  <span className="mini-title">{monthLabel}</span>
                  <div className="mini-grid">
                    {days.map((dayKey, idx) => {
                      if (!dayKey) {
                        return <span key={`${year}-${monthIndex}-${idx}`} className="mini-cell empty" />
                      }
                      const status = getDayStatus(dayMap[dayKey])
                      const inWindow = isDayInWindow(dayKey, windowStartDayKey, windowEndDayKey)
                      const isWindowEdge = dayKey === windowStartDayKey || dayKey === windowEndDayKey
                      return (
                        <span key={dayKey} className={`mini-cell ${inWindow ? 'in-window' : ''} ${isWindowEdge ? 'window-edge' : ''}`}>
                          <img className="status-dot-mini" src={statusToAsset[status]} alt="" aria-hidden="true" />
                        </span>
                      )
                    })}
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
