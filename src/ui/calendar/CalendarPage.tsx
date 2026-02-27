import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { AppState, CalendarZoom, DayKey } from '../../data/types'
import { generateDayMap } from '../../rules/trip_engine'
import { toDayKey } from '../../data/helpers'
import YearView from './YearView'
import MonthView from './MonthView'
import DayView from './DayView'
import { autoFindBestWindow, evaluateWindow } from '../../rules/sed_engine'
import { parseDayKey } from './calendar_helpers'
import { Assets } from '../common/assets'

const zoomOrder: CalendarZoom[] = ['YEAR', 'MONTH', 'DAY']
type HistoryMode = 'push' | 'replace' | 'none'
type ZoomDirection = 'forward' | 'backward'

type Props = {
  state: AppState
  onChange: Dispatch<SetStateAction<AppState>>
}

function zoomOut(current: CalendarZoom): CalendarZoom {
  const index = zoomOrder.indexOf(current)
  return index <= 0 ? 'YEAR' : zoomOrder[index - 1]
}

function getZoomDirection(from: CalendarZoom, to: CalendarZoom): ZoomDirection {
  return zoomOrder.indexOf(to) > zoomOrder.indexOf(from) ? 'forward' : 'backward'
}

export default function CalendarPage({ state, onChange }: Props) {
  const dayMap = useMemo(() => generateDayMap(state.trips, state.overrides), [state.trips, state.overrides])
  const [zoomDirection, setZoomDirection] = useState<ZoomDirection>('forward')

  const selectedDate = state.selectedDate || toDayKey(new Date())
  const selectedStart = state.settings.selectedPeriodStart
  const calendarZoom = state.calendarZoom

  const sedSummary = useMemo(() => {
    if (selectedStart) {
      return evaluateWindow(selectedStart, 365, dayMap)
    }
    return autoFindBestWindow(selectedDate, 730, dayMap).summary
  }, [dayMap, selectedDate, selectedStart])

  useEffect(() => {
    const existing = window.history.state as { calendarZoom?: CalendarZoom; selectedDate?: DayKey } | null
    if (!existing?.calendarZoom) {
      window.history.replaceState({ calendarZoom, selectedDate }, '')
    }

    const handlePop = (event: PopStateEvent) => {
      const nextState = event.state as { calendarZoom?: CalendarZoom; selectedDate?: DayKey } | null
      if (nextState?.calendarZoom) {
        setZoomDirection(getZoomDirection(calendarZoom, nextState.calendarZoom))
        onChange((prev) => ({
          ...prev,
          calendarZoom: nextState.calendarZoom ?? prev.calendarZoom,
          selectedDate: nextState.selectedDate ?? prev.selectedDate,
        }))
        return
      }

      setZoomDirection('backward')
      onChange((prev) =>
        prev.calendarZoom === 'YEAR'
          ? prev
          : {
              ...prev,
              calendarZoom: zoomOut(prev.calendarZoom),
            },
      )
    }

    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [calendarZoom, onChange, selectedDate])

  const setZoomState = (nextZoom: CalendarZoom, nextDate: DayKey, mode: HistoryMode = 'push') => {
    setZoomDirection(getZoomDirection(calendarZoom, nextZoom))
    if (mode === 'push') {
      window.history.pushState({ calendarZoom: nextZoom, selectedDate: nextDate }, '')
    } else if (mode === 'replace') {
      window.history.replaceState({ calendarZoom: nextZoom, selectedDate: nextDate }, '')
    }
    onChange((prev) => ({
      ...prev,
      calendarZoom: nextZoom,
      selectedDate: nextDate,
    }))
  }

  const handleZoomChange = (nextZoom: CalendarZoom, nextDate: DayKey) => {
    setZoomState(nextZoom, nextDate, 'push')
  }

  const handleNavigateMonth = (deltaMonths: number) => {
    const date = parseDayKey(selectedDate)
    const next = new Date(date.getFullYear(), date.getMonth() + deltaMonths, 1)
    setZoomState('MONTH', toDayKey(next), 'push')
  }

  const handleJumpToday = () => {
    const today = toDayKey(new Date())
    setZoomState('MONTH', today, 'push')
  }

  const handleNavigateDay = (deltaDays: number) => {
    const date = parseDayKey(selectedDate)
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + deltaDays)
    setZoomState('DAY', toDayKey(next), 'push')
  }

  const handleJumpTodayDay = () => {
    setZoomState('DAY', toDayKey(new Date()), 'push')
  }

  const jumpTo = (target: CalendarZoom) => {
    if (target === calendarZoom) {
      return
    }
    setZoomState(target, selectedDate, 'push')
  }

  return (
    <div className={`page calendar${calendarZoom === 'DAY' ? ' is-day' : ''}`}>
      <header className="page-header">
        <div className="calendar-title">
          <h2>Calendar</h2>
        </div>
      </header>

      <section className="calendar-sticky-bar" aria-label="Calendar controls and period">
        <div className="calendar-controls">
          <div className="zoom-toggle" role="tablist" aria-label="Calendar zoom">
            <button
              type="button"
              className={`zoom-button${calendarZoom === 'YEAR' ? ' is-active' : ''}`}
              onClick={() => jumpTo('YEAR')}
              role="tab"
              aria-selected={calendarZoom === 'YEAR'}
            >
              Year
            </button>
            <button
              type="button"
              className={`zoom-button${calendarZoom === 'MONTH' ? ' is-active' : ''}`}
              onClick={() => jumpTo('MONTH')}
              role="tab"
              aria-selected={calendarZoom === 'MONTH'}
              disabled={calendarZoom === 'MONTH'}
            >
              Month
            </button>
            <button
              type="button"
              className={`zoom-button${calendarZoom === 'DAY' ? ' is-active' : ''}`}
              onClick={() => jumpTo('DAY')}
              role="tab"
              aria-selected={calendarZoom === 'DAY'}
              disabled={calendarZoom === 'DAY'}
            >
              Day
            </button>
          </div>
        </div>
        <p className="calendar-period-inline">
          {selectedStart ? 'Selected SED period' : 'Auto SED period'}: {sedSummary.startDayKey} to {sedSummary.endDayKey}
        </p>
        {calendarZoom !== 'DAY' ? (
          <div className="calendar-key" aria-label="Calendar status key">
            <span className="calendar-key-item">
              <img className="calendar-key-dot" src={Assets.statusDots.qualifying} alt="" aria-hidden="true" />
              <span className="calendar-key-title">Qualifying</span>
            </span>
            <span className="calendar-key-item">
              <img className="calendar-key-dot" src={Assets.statusDots.atRisk} alt="" aria-hidden="true" />
              <span className="calendar-key-title">At Risk</span>
            </span>
            <span className="calendar-key-item">
              <img className="calendar-key-dot" src={Assets.statusDots.nonQualifying} alt="" aria-hidden="true" />
              <span className="calendar-key-title">Non Qualifying</span>
            </span>
            <span className="calendar-key-item">
              <img className="calendar-key-dot" src={Assets.statusDots.unknown} alt="" aria-hidden="true" />
              <span className="calendar-key-title">Unknown</span>
            </span>
          </div>
        ) : null}
        {calendarZoom === 'DAY' ? (
          <div className="calendar-day-nav" aria-label="Day navigation">
            <button type="button" className="ghost-button" onClick={() => handleNavigateDay(-1)}>
              Prev Day
            </button>
            <button type="button" className="ghost-button" onClick={handleJumpTodayDay}>
              Today
            </button>
            <button type="button" className="ghost-button" onClick={() => handleNavigateDay(1)}>
              Next Day
            </button>
          </div>
        ) : null}
      </section>

      {calendarZoom === 'YEAR' ? (
        <div className={`calendar-view zoom-${zoomDirection}`}>
          <YearView
            dayMap={dayMap}
            onSelectMonth={(dayKey) => handleZoomChange('MONTH', dayKey)}
            windowStartDayKey={sedSummary.startDayKey}
            windowEndDayKey={sedSummary.endDayKey}
          />
        </div>
      ) : null}

      {calendarZoom === 'MONTH' ? (
        <div className={`calendar-view zoom-${zoomDirection}`}>
          <MonthView
            dayMap={dayMap}
            selectedDayKey={selectedDate}
            onSelectDay={(dayKey) => handleZoomChange('DAY', dayKey)}
            onNavigateMonth={handleNavigateMonth}
            onJumpToday={handleJumpToday}
            windowStartDayKey={sedSummary.startDayKey}
            windowEndDayKey={sedSummary.endDayKey}
            onChange={onChange}
          />
        </div>
      ) : null}

      {calendarZoom === 'DAY' ? (
        <div className={`calendar-view zoom-${zoomDirection}`}>
          <DayView dayMap={dayMap} selectedDayKey={selectedDate} state={state} onChange={onChange} />
        </div>
      ) : null}
    </div>
  )
}
