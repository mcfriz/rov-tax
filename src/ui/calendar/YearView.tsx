import type { DayKey } from '../../data/types'
import type { DerivedDay } from '../../rules/trip_engine'
import { buildMonthDays, formatDayKey, getDayStatus, getMonthTint, parseDayKey } from './calendar_helpers'

type Props = {
  dayMap: Record<DayKey, DerivedDay>
  onSelectMonth: (dayKey: DayKey) => void
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function YearView({ dayMap, onSelectMonth }: Props) {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 11 }, (_, idx) => currentYear - 5 + idx)

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
                      return (
                        <span key={dayKey} className={`mini-cell dot ${status}`} aria-label={status} />
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