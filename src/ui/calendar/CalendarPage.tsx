import { useEffect, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { AppState, CalendarZoom, DayKey } from '../../data/types'
import { generateDayMap } from '../../rules/trip_engine'
import { toDayKey } from '../../data/helpers'
import YearView from './YearView'
import MonthView from './MonthView'
import DayView from './DayView'
import { autoFindBestWindow, evaluateWindow } from '../../rules/sed_engine'

const zoomOrder: CalendarZoom[] = ['YEAR', 'MONTH', 'DAY']

type Props = {
  state: AppState
  onChange: Dispatch<SetStateAction<AppState>>
}

function zoomOut(current: CalendarZoom): CalendarZoom {
  const index = zoomOrder.indexOf(current)
  return index <= 0 ? 'YEAR' : zoomOrder[index - 1]
}

function statusTone(status: string): string {
  if (status === 'QUALIFYING') return 'sed-good'
  if (status === 'AT_RISK') return 'sed-warn'
  if (status === 'FAILING') return 'sed-bad'
  return 'sed-unknown'
}

export default function CalendarPage({ state, onChange }: Props) {
  const dayMap = useMemo(() => generateDayMap(state.trips, state.overrides), [state.trips, state.overrides])

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
        onChange((prev) => ({
          ...prev,
          calendarZoom: nextState.calendarZoom ?? prev.calendarZoom,
          selectedDate: nextState.selectedDate ?? prev.selectedDate,
        }))
        return
      }

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

  const handleZoomChange = (nextZoom: CalendarZoom, nextDate: DayKey) => {
    window.history.pushState({ calendarZoom: nextZoom, selectedDate: nextDate }, '')
    onChange((prev) => ({
      ...prev,
      calendarZoom: nextZoom,
      selectedDate: nextDate,
    }))
  }

  const handleBack = () => {
    if (calendarZoom === 'YEAR') {
      return
    }
    window.history.back()
  }

  return (
    <div className="page calendar">
      <header className="page-header calendar-header">
        <div>
          <h2>Calendar</h2>
          <p>Navigate from year to day and refine overrides.</p>
        </div>
        {calendarZoom !== 'YEAR' ? (
          <button type="button" className="ghost-button" onClick={handleBack}>
            Back
          </button>
        ) : null}
      </header>

      <section className={`sed-banner ${statusTone(sedSummary.status)}`}>
        <div>
          <h3>SED Window: {sedSummary.status.replace('_', ' ')}</h3>
          <p>{sedSummary.reason}</p>
          <p>
            {selectedStart ? 'Selected period' : 'Auto period'}: {sedSummary.startDayKey} to {sedSummary.endDayKey}
          </p>
        </div>
        <div className="sed-meta">
          <span>UK: {sedSummary.ukMidnights}</span>
          <span>Abroad: {sedSummary.abroadMidnights}</span>
          <span>Unknown: {sedSummary.unknownDays}</span>
          <span>Buffer: {sedSummary.bufferUkDaysRemaining}</span>
        </div>
      </section>

      {calendarZoom === 'YEAR' ? (
        <YearView
          dayMap={dayMap}
          onSelectMonth={(dayKey) => handleZoomChange('MONTH', dayKey)}
          windowStartDayKey={sedSummary.startDayKey}
          windowEndDayKey={sedSummary.endDayKey}
          focusWindowOnly={Boolean(selectedStart)}
        />
      ) : null}

      {calendarZoom === 'MONTH' ? (
        <MonthView
          dayMap={dayMap}
          selectedDayKey={selectedDate}
          onSelectDay={(dayKey) => handleZoomChange('DAY', dayKey)}
          windowStartDayKey={sedSummary.startDayKey}
          windowEndDayKey={sedSummary.endDayKey}
          onChange={onChange}
        />
      ) : null}

      {calendarZoom === 'DAY' ? (
        <DayView dayMap={dayMap} selectedDayKey={selectedDate} state={state} onChange={onChange} />
      ) : null}
    </div>
  )
}
