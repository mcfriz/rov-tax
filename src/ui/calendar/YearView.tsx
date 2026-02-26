import type { DayKey } from '../../data/types'
import type { DerivedDay } from '../../rules/trip_engine'
import { buildMonthDays, formatDayKey, getDayStatus, getMonthTint, isDayInWindow, parseDayKey } from './calendar_helpers'
import { Assets } from '../common/assets'

type Props = {
  dayMap: Record<DayKey, DerivedDay>
  onSelectMonth: (dayKey: DayKey) => void
  windowStartDayKey: DayKey
  windowEndDayKey: DayKey
  focusWindowOnly: boolean
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const statusToAsset: Record<string, string> = {
  qualifying: Assets.statusDots.qualifying,
  'at-risk': Assets.statusDots.atRisk,
  non: Assets.statusDots.nonQualifying,
  unknown: Assets.statusDots.unknown,
}

export default function YearView({
  dayMap,
  onSelectMonth,
  windowStartDayKey,
  windowEndDayKey,
  focusWindowOnly,
}: Props) {
  const currentYear = new Date().getFullYear()
  const windowStartYear = parseDayKey(windowStartDayKey).getFullYear()
  const windowEndYear = parseDayKey(windowEndDayKey).getFullYear()
  const years = focusWindowOnly
    ? Array.from({ length: windowEndYear - windowStartYear + 1 }, (_, idx) => windowStartYear + idx)
    : Array.from({ length: 11 }, (_, idx) => currentYear - 5 + idx)

  return (
    <div className="year-view">
      {years.map((year) => (
        <section key={year} className="year-block">
          <h3>{year}</h3>
          <div className="year-months">
            {monthNames.map((monthLabel, monthIndex) => {
              const days = buildMonthDays(year, monthIndex)
              const monthStart = formatDayKey(new Date(year, monthIndex, 1))
              const monthDerived = Object.values(dayMap).filter((day) => {
                const date = parseDayKey(day.dayKey)
                return date.getFullYear() === year && date.getMonth() === monthIndex
              })
              const tint = getMonthTint(monthDerived)

              return (
                <button
                  key={`${year}-${monthLabel}`}
                  type="button"
                  className={`mini-month ${tint}`}
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
                      return (
                        <span key={dayKey} className={`mini-cell ${inWindow ? 'in-window' : ''}`}>
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
