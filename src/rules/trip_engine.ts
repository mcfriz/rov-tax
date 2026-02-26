import type { DayOverride, DayKey, DutyType, MidnightLocation, Trip, TripType } from '../data/types'

export type DerivedDay = {
  dayKey: DayKey
  sourceTripId: string | null
  tripType: TripType | null
  midnightLocation: MidnightLocation
  dutyType: DutyType
  countsTowardSed: boolean
  vessel?: string
  notes?: string
  isPlanned: boolean
  isOverride: boolean
  lastEdited: number
  conflict?: boolean
}

const dayMs = 24 * 60 * 60 * 1000

const sectorToMidnight: Record<Trip['sectorDefault'], MidnightLocation> = {
  UK_OUTSIDE_12NM: 'OUTSIDE_UK',
  UK_INSIDE_12NM: 'INSIDE_12NM_UK',
  NORWAY: 'NORWAY_SECTOR',
  OTHER: 'UNKNOWN',
}

function parseDayKey(dayKey: DayKey): Date {
  const [year, month, day] = dayKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDayKey(date: Date): DayKey {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * dayMs)
}

function getTripUpdatedAt(trip: Trip): number {
  const parsed = Date.parse(trip.updatedAt)
  return Number.isNaN(parsed) ? 0 : parsed
}

function isTripConfirmed(trip: Trip): boolean {
  return !trip.planned
}

function chooseTrip(a: Trip, b: Trip): { trip: Trip; conflict: boolean } {
  const aConfirmed = isTripConfirmed(a)
  const bConfirmed = isTripConfirmed(b)

  if (aConfirmed !== bConfirmed) {
    return { trip: aConfirmed ? a : b, conflict: false }
  }

  const aUpdated = getTripUpdatedAt(a)
  const bUpdated = getTripUpdatedAt(b)

  if (aUpdated !== bUpdated) {
    return { trip: aUpdated > bUpdated ? a : b, conflict: false }
  }

  return { trip: a, conflict: true }
}

function deriveFromTrip(trip: Trip, dayKey: DayKey): DerivedDay {
  return {
    dayKey,
    sourceTripId: trip.id,
    tripType: trip.tripType,
    midnightLocation: sectorToMidnight[trip.sectorDefault],
    dutyType: trip.dutyDefault,
    countsTowardSed: trip.countsTowardSedDefault,
    vessel: trip.vessel,
    notes: undefined,
    isPlanned: trip.planned,
    isOverride: false,
    lastEdited: getTripUpdatedAt(trip),
  }
}

function emptyDerived(dayKey: DayKey): DerivedDay {
  return {
    dayKey,
    sourceTripId: null,
    tripType: null,
    midnightLocation: 'UNKNOWN',
    dutyType: 'OTHER',
    countsTowardSed: false,
    vessel: undefined,
    notes: undefined,
    isPlanned: false,
    isOverride: false,
    lastEdited: 0,
  }
}

function applyOverride(base: DerivedDay, override: DayOverride): DerivedDay {
  return {
    ...base,
    midnightLocation: override.midnightLocation ?? base.midnightLocation,
    dutyType: override.dutyType ?? base.dutyType,
    countsTowardSed: override.countsTowardSed ?? base.countsTowardSed,
    vessel: override.vessel ?? base.vessel,
    notes: override.notes ?? base.notes,
    isOverride: true,
    lastEdited: override.lastEdited,
  }
}

function deriveHomeDay(dayKey: DayKey): DerivedDay {
  return {
    dayKey,
    sourceTripId: null,
    tripType: 'UK_HOME',
    midnightLocation: 'INSIDE_12NM_UK',
    dutyType: 'LEAVE',
    countsTowardSed: false,
    vessel: undefined,
    notes: undefined,
    isPlanned: false,
    isOverride: false,
    lastEdited: 0,
  }
}

function fillHomeGaps(trips: Trip[], map: Record<DayKey, DerivedDay>) {
  if (trips.length === 0) {
    return
  }

  const sorted = [...trips].sort((a, b) => a.startDayKey.localeCompare(b.startDayKey))
  const minStart = sorted[0].startDayKey
  const maxEnd = sorted[sorted.length - 1].endDayKey

  const start = parseDayKey(minStart)
  const end = parseDayKey(maxEnd)
  const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / dayMs))

  for (let i = 0; i <= days; i += 1) {
    const dayKey = formatDayKey(addDays(start, i))
    if (!map[dayKey]) {
      map[dayKey] = deriveHomeDay(dayKey)
    }
  }
}

export function generateDayMap(
  trips: Trip[],
  overrides: Record<DayKey, DayOverride>,
): Record<DayKey, DerivedDay> {
  const map: Record<DayKey, DerivedDay> = {}
  const conflicts = new Set<DayKey>()

  for (const trip of trips) {
    const start = parseDayKey(trip.startDayKey)
    const end = parseDayKey(trip.endDayKey)
    const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / dayMs))

    for (let i = 0; i <= days; i += 1) {
      const dayKey = formatDayKey(addDays(start, i))
      const existing = map[dayKey]

      if (!existing || !existing.sourceTripId) {
        map[dayKey] = deriveFromTrip(trip, dayKey)
        continue
      }

      const existingTrip = trips.find((candidate) => candidate.id === existing.sourceTripId)
      if (!existingTrip) {
        map[dayKey] = deriveFromTrip(trip, dayKey)
        continue
      }

      const resolved = chooseTrip(existingTrip, trip)
      map[dayKey] = deriveFromTrip(resolved.trip, dayKey)
      if (resolved.conflict) {
        conflicts.add(dayKey)
      }
    }
  }

  fillHomeGaps(trips, map)

  for (const [dayKey, override] of Object.entries(overrides)) {
    const base = map[dayKey] ?? emptyDerived(dayKey)
    map[dayKey] = applyOverride(base, override)
  }

  for (const dayKey of conflicts) {
    if (map[dayKey]) {
      map[dayKey].conflict = true
    }
  }

  return map
}

export function debugPrintWeek(startDayKey: DayKey, dayMap: Record<DayKey, DerivedDay>) {
  const start = parseDayKey(startDayKey)
  const lines: string[] = []

  for (let i = 0; i < 7; i += 1) {
    const dayKey = formatDayKey(addDays(start, i))
    const entry = dayMap[dayKey]
    if (!entry) {
      lines.push(`${dayKey}: (no data)`) 
      continue
    }

    lines.push(
      `${dayKey}: ${entry.tripType ?? 'NONE'} | ${entry.dutyType} | ${entry.midnightLocation} | ` +
        `${entry.countsTowardSed ? 'SED' : 'NO-SED'}${entry.conflict ? ' | CONFLICT' : ''}`,
    )
  }

  return lines.join('\n')
}

// Tests (as comments):
// 1) Inclusive end: trip 2026-02-01..2026-02-02 yields 2 days in map.
// 2) Overlap priority: confirmed trip beats planned on same day.
// 3) Overlap updatedAt: later updatedAt wins when both planned or both confirmed.
// 4) Conflict flag: same updatedAt and same plan status => conflict true.
// 5) Override apply: override countsTowardSed replaces base value only for that field.
// 6) Override-only day: if no trip, base defaults used and override applied.
// 7) Local dayKey: parse/format round-trips with local timezone.
