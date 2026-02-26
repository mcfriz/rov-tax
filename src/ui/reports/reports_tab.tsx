import { useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { AppState } from '../../data/types'
import { toDayKey } from '../../data/helpers'
import { generateDayMap } from '../../rules/trip_engine'
import { autoFindBestWindow, evaluateWindow } from '../../rules/sed_engine'
import { exportWindowCsv } from '../../rules/csv_export'

type Props = {
  state: AppState
  onChange: Dispatch<SetStateAction<AppState>>
}

export default function ReportsTab({ state }: Props) {
  const dayMap = useMemo(() => generateDayMap(state.trips, state.overrides), [state.trips, state.overrides])
  const selectedStart = state.settings.selectedPeriodStart
  const anchorDate = state.selectedDate || toDayKey(new Date())

  const summary = useMemo(() => {
    if (selectedStart) {
      return evaluateWindow(selectedStart, 365, dayMap)
    }
    return autoFindBestWindow(anchorDate, 730, dayMap).summary
  }, [anchorDate, dayMap, selectedStart])

  const tripTitles = useMemo(() => {
    return state.trips.reduce<Record<string, string>>((acc, trip) => {
      acc[trip.id] = trip.title
      return acc
    }, {})
  }, [state.trips])

  const csvExport = useMemo(
    () => exportWindowCsv(summary.startDayKey, 365, dayMap, tripTitles),
    [summary.startDayKey, dayMap, tripTitles],
  )

  const handleDownload = () => {
    const blob = new Blob([csvExport.csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `rov-tax-${summary.startDayKey}-to-${summary.endDayKey}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page reports">
      <header className="page-header">
        <h2>Reports</h2>
        <p>Export a CSV snapshot for your accountant or records.</p>
      </header>

      <section className="card reports-summary">
        <h3>SED Window Export</h3>
        <p>{summary.startDayKey} to {summary.endDayKey}</p>
        <div className="overview-grid">
          <div>
            <span className="overview-label">Abroad midnights</span>
            <strong>{summary.abroadMidnights}</strong>
          </div>
          <div>
            <span className="overview-label">UK midnights</span>
            <strong>{summary.ukMidnights}</strong>
          </div>
          <div>
            <span className="overview-label">Unknown days</span>
            <strong>{summary.unknownDays}</strong>
          </div>
          <div>
            <span className="overview-label">Norway sector</span>
            <strong>{summary.norwayMidnights}</strong>
          </div>
        </div>
        <button type="button" className="primary-button" onClick={handleDownload}>
          Download CSV
        </button>
      </section>

      <section className="card reports-preview">
        <h3>CSV Preview</h3>
        <div className="csv-preview">
          <pre>{csvExport.csv}</pre>
        </div>
      </section>

      <section className="card reports-stub">
        <h3>Accountant Pack (paid later)</h3>
        <p>Custom formatted reports, evidence packs, and filing exports will appear here.</p>
      </section>
    </div>
  )
}
