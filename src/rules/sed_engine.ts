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
  inside12NmTripTaggedDays: number
  unknownDays: number
  totalKnownDays: number
  passesHalfRule: boolean
  margin: number
  longestConsecutiveUkStreak: number
  failsConsecutiveUkRule: boolean
  bufferUkDaysRemaining: number
  fixNeededAbroadDays: number
  confidencePercent: number
  bestCasePassesHalfRule: boolean
  worstCasePassesHalfRule: boolean
  status: SedStatus
  reason: string
  criticalRanges: Array<{ startDayKey: DayKey; endDayKey: DayKey }>
}

const dayMs = 24 * 60 * 60 * 1000

function isUkMidnight(day: DerivedDay | undefined): boolean {
  // Missing day entries are treated as UK/home in v1.
  return !day || day.midnightLocation === 'INSIDE_12NM_UK'
}

function isAbroadMidnight(day: DerivedDay | undefined): boolean {
  return day?.midnightLocation === 'OUTSIDE_UK' || day?.midnightLocation === 'NORWAY_SECTOR'
}

function isUnknown(day: DerivedDay | undefined): boolean {
  // Unknown now means explicitly tagged unknown only.
  return day !== undefined && day.midnightLocation === 'UNKNOWN'
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

type RangeSegment = {
  startDayKey: DayKey
  endDayKey: DayKey
  length: number
  endIndex: number
}

function collectUkSegments(days: DayKey[], dayMap: Record<DayKey, DerivedDay>): RangeSegment[] {
  const segments: RangeSegment[] = []
  let startIndex = -1

  for (let i = 0; i < days.length; i += 1) {
    const dayKey = days[i]
    const uk = isUkMidnight(dayMap[dayKey])
    if (uk && startIndex === -1) {
      startIndex = i
    }
    if (!uk && startIndex !== -1) {
      segments.push({
        startDayKey: days[startIndex],
        endDayKey: days[i - 1],
        length: i - startIndex,
        endIndex: i - 1,
      })
      startIndex = -1
    }
  }

  if (startIndex !== -1) {
    segments.push({
      startDayKey: days[startIndex],
      endDayKey: days[days.length - 1],
      length: days.length - startIndex,
      endIndex: days.length - 1,
    })
  }

  return segments
}

function calcCriticalRanges(
  days: DayKey[],
  dayMap: Record<DayKey, DerivedDay>,
  fixNeededAbroadDays: number,
): Array<{ startDayKey: DayKey; endDayKey: DayKey }> {
  if (fixNeededAbroadDays <= 0) {
    return []
  }

  const ranked = collectUkSegments(days, dayMap).sort((a, b) => {
    if (a.length !== b.length) {
      return b.length - a.length
    }
    return b.endIndex - a.endIndex
  })

  const selected: Array<{ startDayKey: DayKey; endDayKey: DayKey }> = []
  let covered = 0

  for (const segment of ranked) {
    selected.push({ startDayKey: segment.startDayKey, endDayKey: segment.endDayKey })
    covered += segment.length
    if (covered >= fixNeededAbroadDays) {
      break
    }
  }

  return selected
}

function getConfidencePercent(unknownDays: number, windowLength: number, ambiguous: boolean): number {
  const base = Math.max(0, 100 - Math.round((unknownDays / windowLength) * 100))
  if (!ambiguous) {
    return base
  }
  return Math.min(base, 65)
}

function classifyStatus(
  passesHalfRule: boolean,
  failsConsecutiveUkRule: boolean,
  margin: number,
  ukMidnights: number,
  abroadMidnights: number,
  unknownDays: number,
  bestCasePassesHalfRule: boolean,
  worstCasePassesHalfRule: boolean,
): { status: SedStatus; reason: string; buffer: number } {
  if (ukMidnights + abroadMidnights === 0) {
    return { status: 'UNKNOWN', reason: 'No known midnight locations in window.', buffer: 0 }
  }

  if (failsConsecutiveUkRule) {
    return { status: 'FAILING', reason: 'UK consecutive midnight streak is above 183 days.', buffer: 0 }
  }

  if (!passesHalfRule) {
    return { status: 'FAILING', reason: 'UK midnights are not lower than abroad midnights.', buffer: 0 }
  }

  if (unknownDays > 0 && bestCasePassesHalfRule !== worstCasePassesHalfRule) {
    return { status: 'UNKNOWN', reason: 'Unknown days can change pass/fail outcome.', buffer: Math.max(0, margin) }
  }

  if (margin <= 7 || unknownDays > 0) {
    return { status: 'AT_RISK', reason: 'Window passes but buffer is tight or uncertainty remains.', buffer: Math.max(0, margin) }
  }

  return { status: 'QUALIFYING', reason: 'Window passes with a healthy abroad-vs-UK margin.', buffer: Math.max(0, margin) }
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
  let inside12NmTripTaggedDays = 0
  let unknownDays = 0

  for (const dayKey of days) {
    const day = dayMap[dayKey]
    if (isUnknown(day)) {
      unknownDays += 1
      continue
    }
    if (day?.midnightLocation === 'INSIDE_12NM_UK' && day.sourceTripId) {
      inside12NmTripTaggedDays += 1
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
  const passesHalfRule = abroadMidnights > ukMidnights
  const margin = abroadMidnights - ukMidnights
  const longestConsecutiveUkStreak = calcLongestUkStreak(days, dayMap)
  const failsConsecutiveUkRule = longestConsecutiveUkStreak > 183
  const bufferUkDaysRemaining = Math.max(0, abroadMidnights - ukMidnights)
  const fixNeededAbroadDays = Math.max(0, ukMidnights - abroadMidnights + 1)

  const bestCasePassesHalfRule = abroadMidnights + unknownDays > ukMidnights
  const worstCasePassesHalfRule = abroadMidnights > ukMidnights + unknownDays
  const ambiguousUnknown = unknownDays > 0 && bestCasePassesHalfRule !== worstCasePassesHalfRule
  const confidencePercent = getConfidencePercent(unknownDays, length, ambiguousUnknown)

  const { status, reason } = classifyStatus(
    passesHalfRule,
    failsConsecutiveUkRule,
    margin,
    ukMidnights,
    abroadMidnights,
    unknownDays,
    bestCasePassesHalfRule,
    worstCasePassesHalfRule,
  )
  const criticalRanges = calcCriticalRanges(days, dayMap, fixNeededAbroadDays)

  return {
    startDayKey,
    endDayKey: days[days.length - 1],
    abroadMidnights,
    ukMidnights,
    norwayMidnights,
    inside12NmTripTaggedDays,
    unknownDays,
    totalKnownDays,
    passesHalfRule,
    margin,
    longestConsecutiveUkStreak,
    failsConsecutiveUkRule,
    bufferUkDaysRemaining,
    fixNeededAbroadDays,
    confidencePercent,
    bestCasePassesHalfRule,
    worstCasePassesHalfRule,
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
// 2) Missing dayMap entries count as UK/home, not unknown.
// 3) NORWAY_SECTOR increments abroad and norway.
// 4) Unknown days are only explicit midnightLocation UNKNOWN.
// 5) inside12NmTripTaggedDays counts INSIDE_12NM_UK only when sourceTripId exists.
// 5) autoFindBestWindow prefers qualifying windows with fewer UK/unknown days.
