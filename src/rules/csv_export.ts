import type { DayKey } from '../data/types'
import type { DerivedDay } from './trip_engine'
import { addDays, formatDayKey, parseDayKey } from '../ui/calendar/calendar_helpers'
import { getDayStatus } from '../ui/calendar/calendar_helpers'

export type CsvRow = {
  dayKey: DayKey
  tripTitle: string
  tripType: string
  planned: string
  midnightLocation: string
  dutyType: string
  countsTowardSed: string
  vessel: string
  notes: string
  isOverride: string
  status: string
  reason: string
}

function escapeValue(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function toCsv(rows: CsvRow[]): string {
  const headers = [
    'dayKey',
    'tripTitle',
    'tripType',
    'planned',
    'midnightLocation',
    'dutyType',
    'countsTowardSed',
    'vessel',
    'notes',
    'isOverride',
    'status',
    'reason',
  ]

  const lines = [headers.join(',')]
  for (const row of rows) {
    const values = headers.map((header) => {
      const key = header as keyof CsvRow
      return escapeValue(String(row[key] ?? ''))
    })
    lines.push(values.join(','))
  }

  return lines.join('\n')
}

function statusReason(status: string, day: DerivedDay | undefined): string {
  switch (status) {
    case 'qualifying':
      return 'Counts toward SED and abroad midnight.'
    case 'non':
      return 'Home/holiday day in UK.'
    case 'at-risk':
      return 'Non-qualifying or UK/unknown risk day.'
    case 'unknown':
    default:
      return day?.midnightLocation === 'UNKNOWN' ? 'Unknown midnight location.' : 'No trip data.'
  }
}

export function buildCsvRows(
  startDayKey: DayKey,
  length: number,
  dayMap: Record<DayKey, DerivedDay>,
  tripTitles: Record<string, string>,
): CsvRow[] {
  const start = parseDayKey(startDayKey)
  const rows: CsvRow[] = []

  for (let i = 0; i < length; i += 1) {
    const dayKey = formatDayKey(addDays(start, i))
    const day = dayMap[dayKey]
    const status = getDayStatus(day)

    rows.push({
      dayKey,
      tripTitle: day?.sourceTripId ? tripTitles[day.sourceTripId] ?? '' : '',
      tripType: day?.tripType ?? '',
      planned: day ? (day.isPlanned ? 'yes' : 'no') : '',
      midnightLocation: day?.midnightLocation ?? '',
      dutyType: day?.dutyType ?? '',
      countsTowardSed: day ? (day.countsTowardSed ? 'yes' : 'no') : '',
      vessel: day?.vessel ?? '',
      notes: day?.notes ?? '',
      isOverride: day ? (day.isOverride ? 'yes' : 'no') : '',
      status,
      reason: statusReason(status, day),
    })
  }

  return rows
}

export function exportWindowCsv(
  startDayKey: DayKey,
  length: number,
  dayMap: Record<DayKey, DerivedDay>,
  tripTitles: Record<string, string>,
): { csv: string; rows: CsvRow[] } {
  const rows = buildCsvRows(startDayKey, length, dayMap, tripTitles)
  return {
    csv: toCsv(rows),
    rows,
  }
}

// Tests (as comments):
// 1) Escapes commas/quotes/newlines.
// 2) Generates 365 rows for length=365.
// 3) Status and reason derived from day status.