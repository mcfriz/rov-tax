import type { DayKey } from '../data/types'
import type { DerivedDay } from './trip_engine'
import { addDays, formatDayKey, parseDayKey } from '../ui/calendar/calendar_helpers'

export type SedStatus = 'QUALIFYING' | 'AT_RISK' | 'FAILING' | 'UNKNOWN'

export type SedSummary = {
  startDayKey: DayKey
  endDayKey: DayKey
  abroadMidnights: number
  ukMidnights: number
  norwayMidnights: number
  unknownDays: number
  totalKnownDays: number
  passesHalfRule: boolean
  margin: number
  longestConsecutiveUkStreak: number
  bufferUkDaysRemaining: number
  status: SedStatus
  reason: string
  criticalRanges: Array<{ startDayKey: DayKey; endDayKey: DayKey }>
}

const dayMs = 24 * 60 * 60 * 1000

function isUkMidnight(day: DerivedDay | undefined): boolean {
  return day?.midnightLocation === 'INSIDE_12NM_UK'
}

function isAbroadMidnight(day: DerivedDay | undefined): boolean {
  return day?.midnightLocation === 'OUTSIDE_UK' || day?.midnightLocation === 'NORWAY_SECTOR'
}

function isUnknown(day: DerivedDay | undefined): boolean {
  return !day || day.midnightLocation === 'UNKNOWN'
}

function getWindowDays(startDayKey: DayKey, length: number): DayKey[] {
  const start = parseDayKey(startDayKey)
  const days: DayKey[] = []
  for (let i = 0; i < length; i += 1) {
    days.push(formatDayKey(addDays(start, i)))
  }
  return days
}

function calcLongestUkStreak(days: DayKey[], dayMap: Record<DayKey, DerivedDay>): number {
  let best = 0
  let current = 0
  for (const dayKey of days) {
    if (isUkMidnight(dayMap[dayKey])) {
      current += 1
      if (current > best) {
        best = current
      }
    } else {
      current = 0
    }
  }
  return best
}

function calcCriticalRanges(days: DayKey[], dayMap: Record<DayKey, DerivedDay>): Array<{ startDayKey: DayKey; endDayKey: DayKey }> {
  const ranges: Array<{ startDayKey: DayKey; endDayKey: DayKey }> = []
  let rangeStart: DayKey | null = null
  for (const dayKey of days) {
    const day = dayMap[dayKey]
    const uk = isUkMidnight(day)
    const unknown = isUnknown(day)
    if (uk || unknown) {
      if (!rangeStart) {
        rangeStart = dayKey
      }
    } else if (rangeStart) {
      ranges.push({ startDayKey: rangeStart, endDayKey: dayKey })
      rangeStart = null
    }
  }
  if (rangeStart) {
    const last = days[days.length - 1]
    ranges.push({ startDayKey: rangeStart, endDayKey: last })
  }
  return ranges
}

function classifyStatus(
  ukMidnights: number,
  totalKnownDays: number,
  unknownDays: number,
): { status: SedStatus; reason: string; buffer: number } {
  if (totalKnownDays === 0) {
    return { status: 'UNKNOWN', reason: 'No known midnight locations in window.', buffer: 0 }
  }

  const limit = Math.floor(totalKnownDays / 2)
  const passes = ukMidnights < totalKnownDays / 2
  const margin = limit - ukMidnights

  if (!passes) {
    return { status: 'FAILING', reason: 'UK midnights exceed half of known days.', buffer: 0 }
  }

  if (margin <= 3 || unknownDays > 20) {
    return { status: 'AT_RISK', reason: 'Small buffer or many unknown days in window.', buffer: margin }
  }

  return { status: 'QUALIFYING', reason: 'UK midnights below half of known days.', buffer: margin }
}

export function evaluateWindow(
  startDayKey: DayKey,
  length = 365,
  dayMap: Record<DayKey, DerivedDay>,
): SedSummary {
  const days = getWindowDays(startDayKey, length)
  let abroadMidnights = 0
  let norwayMidnights = 0
  let ukMidnights = 0
  let unknownDays = 0

  for (const dayKey of days) {
    const day = dayMap[dayKey]
    if (isUnknown(day)) {
      unknownDays += 1
      continue
    }
    if (day?.midnightLocation === 'NORWAY_SECTOR') {
      norwayMidnights += 1
      abroadMidnights += 1
      continue
    }
    if (isAbroadMidnight(day)) {
      abroadMidnights += 1
      continue
    }
    if (isUkMidnight(day)) {
      ukMidnights += 1
    }
  }

  const totalKnownDays = abroadMidnights + ukMidnights
  const passesHalfRule = totalKnownDays > 0 ? ukMidnights < totalKnownDays / 2 : false
  const margin = Math.floor(totalKnownDays / 2) - ukMidnights
  const longestConsecutiveUkStreak = calcLongestUkStreak(days, dayMap)
  const bufferUkDaysRemaining = Math.max(0, margin)
  const { status, reason } = classifyStatus(ukMidnights, totalKnownDays, unknownDays)
  const criticalRanges = calcCriticalRanges(days, dayMap)

  return {
    startDayKey,
    endDayKey: days[days.length - 1],
    abroadMidnights,
    ukMidnights,
    norwayMidnights,
    unknownDays,
    totalKnownDays,
    passesHalfRule,
    margin,
    longestConsecutiveUkStreak,
    bufferUkDaysRemaining,
    status,
    reason,
    criticalRanges,
  }
}

export function autoFindBestWindow(
  anchorDayKey: DayKey,
  searchRangeDays = 730,
  dayMap: Record<DayKey, DerivedDay>,
): { startDayKey: DayKey; summary: SedSummary } {
  const anchor = parseDayKey(anchorDayKey)
  const startSearch = addDays(anchor, -Math.floor(searchRangeDays / 2))
  const endSearch = addDays(anchor, Math.floor(searchRangeDays / 2))

  let bestSummary: SedSummary | null = null
  let bestScore = Number.POSITIVE_INFINITY
  let cursor = new Date(startSearch)

  while (cursor <= endSearch) {
    const start = formatDayKey(cursor)
    const summary = evaluateWindow(start, 365, dayMap)

    const statusWeight = summary.status === 'QUALIFYING' ? 0 : summary.status === 'AT_RISK' ? 10_000 : 20_000
    const score = statusWeight + summary.ukMidnights + summary.unknownDays * 2

    if (!bestSummary || score < bestScore) {
      bestSummary = summary
      bestScore = score
    }

    cursor = new Date(cursor.getTime() + dayMs)
  }

  const chosen = bestSummary ?? evaluateWindow(anchorDayKey, 365, dayMap)
  return { startDayKey: chosen.startDayKey, summary: chosen }
}

// Tests (as comments):
// 1) Half rule: ukMidnights < totalKnownDays/2 passes.
// 2) Unknown days do not count in totalKnownDays.
// 3) NORWAY_SECTOR increments abroad and norway.
// 4) Critical ranges include stretches of UK/UNKNOWN days.
// 5) autoFindBestWindow prefers qualifying windows with fewer UK/unknown days.