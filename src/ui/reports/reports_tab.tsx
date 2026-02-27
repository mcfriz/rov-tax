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

function statusPillClass(status: string): string {
  if (status === 'QUALIFYING') return 'is-good'
  if (status === 'AT_RISK') return 'is-warn'
  if (status === 'FAILING') return 'is-bad'
  return 'is-unknown'
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
  const previewMaxLines = 60
  const previewRows = useMemo(() => {
    const allLines = csvExport.csv.split('\n')
    return {
      text: allLines.slice(0, previewMaxLines).join('\n'),
      total: allLines.length,
      truncated: allLines.length > previewMaxLines,
    }
  }, [csvExport.csv])

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

      <section className="card reports-window">
        <div className="reports-window-top">
          <div>
            <h3>SED Window Export</h3>
            <p className="reports-window-range">
              {summary.startDayKey} to {summary.endDayKey}
            </p>
          </div>
          <span className={`overview-status-pill ${statusPillClass(summary.status)}`}>{summary.status.replace('_', ' ')}</span>
        </div>

        <div className="reports-metrics">
          <div className="reports-metric">
            <span className="overview-label">Abroad Midnights</span>
            <strong>{summary.abroadMidnights}</strong>
          </div>
          <div className="reports-metric">
            <span className="overview-label">UK Midnights</span>
            <strong>{summary.ukMidnights}</strong>
          </div>
          <div className="reports-metric">
            <span className="overview-label">Unknown Days</span>
            <strong>{summary.unknownDays}</strong>
          </div>
          <div className="reports-metric">
            <span className="overview-label">Norway Sector</span>
            <strong>{summary.norwayMidnights}</strong>
          </div>
        </div>

        <div className="reports-actions">
          <button type="button" className="primary-button" onClick={handleDownload}>
            Download CSV
          </button>
          <span className="reports-hint-chip">{csvExport.rows.length} rows ready</span>
        </div>
      </section>

      <section className="card reports-preview">
        <div className="reports-preview-head">
          <h3>CSV Preview</h3>
          <span className="reports-hint-chip">Showing {Math.min(previewRows.total, previewMaxLines)} of {previewRows.total}</span>
        </div>
        <div className="csv-preview">
          <pre>{previewRows.text}</pre>
        </div>
        {previewRows.truncated ? <p className="hint">Preview is truncated. Download CSV for full export.</p> : null}
      </section>

      <section className="card reports-stub">
        <h3>Accountant Pack (paid later)</h3>
        <p>Custom formatted reports, evidence packs, and filing exports will appear here.</p>
      </section>
    </div>
  )
}
