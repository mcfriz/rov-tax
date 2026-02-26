import type { DayKey, SectorDefault, Trip, TripType } from '../data/types'
import { createTrip, toDayKey } from '../data/helpers'

export type RotaTemplateInput = {
  startDayKey: DayKey
  onWeeks: number
  offWeeks: number
  cycles?: number
  endDayKey?: DayKey
  defaultVessel?: string
  offshoreSector: SectorDefault
}

export type RotaGenerationResult = {
  plannedTrips: Trip[]
  skippedConfirmedOverlaps: number
  skippedPlannedOverlaps: number
}

const dayMs = 24 * 60 * 60 * 1000

function parseDayKey(dayKey: DayKey): Date {
  const [year, month, day] = dayKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * dayMs)
}

function formatDayKey(date: Date): DayKey {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function expandDays(startDayKey: DayKey, endDayKey: DayKey): Set<DayKey> {
  const start = parseDayKey(startDayKey)
  const end = parseDayKey(endDayKey)
  const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / dayMs))
  const set = new Set<DayKey>()
  for (let i = 0; i <= days; i += 1) {
    set.add(formatDayKey(addDays(start, i)))
  }
  return set
}

function overlaps(existing: Trip, candidateStart: DayKey, candidateEnd: DayKey): boolean {
  return !(candidateEnd < existing.startDayKey || candidateStart > existing.endDayKey)
}

function isConfirmed(trip: Trip): boolean {
  return !trip.planned
}

export function generateRotaTrips(
  existingTrips: Trip[],
  input: RotaTemplateInput,
): RotaGenerationResult {
  const onDays = Math.max(1, Math.round(input.onWeeks * 7))
  const offDays = Math.max(1, Math.round(input.offWeeks * 7))

  const plannedTrips: Trip[] = []
  let skippedConfirmedOverlaps = 0
  let skippedPlannedOverlaps = 0

  let cursor = parseDayKey(input.startDayKey)
  const endDate = input.endDayKey ? parseDayKey(input.endDayKey) : addDays(cursor, 365)

  const maxCycles = input.cycles && input.cycles > 0 ? input.cycles : Number.POSITIVE_INFINITY
  let cycle = 0

  while (cursor <= endDate && cycle < maxCycles) {
    const offshoreStart = formatDayKey(cursor)
    const offshoreEnd = formatDayKey(addDays(cursor, onDays - 1))

    const offshoreTrip = createTrip({
      title: 'Planned Offshore Rotation',
      tripType: 'OFFSHORE_WORK',
      startDayKey: offshoreStart,
      endDayKey: offshoreEnd,
      vessel: input.defaultVessel || undefined,
      sectorDefault: input.offshoreSector,
      dutyDefault: 'OFFSHORE',
      countsTowardSedDefault: true,
      planned: true,
    })

    const homeStartDate = addDays(cursor, onDays)
    const homeStart = formatDayKey(homeStartDate)
    const homeEnd = formatDayKey(addDays(homeStartDate, offDays - 1))

    const homeTrip = createTrip({
      title: 'Planned Home Leave',
      tripType: 'UK_HOME',
      startDayKey: homeStart,
      endDayKey: homeEnd,
      sectorDefault: 'OTHER',
      dutyDefault: 'LEAVE',
      countsTowardSedDefault: false,
      planned: true,
    })

    const generated: Trip[] = [offshoreTrip, homeTrip]

    for (const candidate of generated) {
      const conflictingTrips = existingTrips.filter((trip) => overlaps(trip, candidate.startDayKey, candidate.endDayKey))
      if (conflictingTrips.length === 0) {
        plannedTrips.push(candidate)
        continue
      }

      const hasConfirmed = conflictingTrips.some(isConfirmed)
      if (hasConfirmed) {
        skippedConfirmedOverlaps += 1
        continue
      }

      skippedPlannedOverlaps += 1
    }

    cursor = addDays(cursor, onDays + offDays)
    cycle += 1
  }

  return {
    plannedTrips,
    skippedConfirmedOverlaps,
    skippedPlannedOverlaps,
  }
}

export function debugPrintRota(input: RotaTemplateInput): string {
  const result = generateRotaTrips([], input)
  return result.plannedTrips
    .map((trip) => `${trip.tripType} ${trip.startDayKey} ? ${trip.endDayKey}`)
    .join('\n')
}

// Tests (as comments):
// 1) onWeeks=4 offWeeks=4 generates 2 blocks per cycle.
// 2) endDayKey limits generation window (inclusive end).
// 3) cycles limits number of offshore+home pairs.
// 4) confirmed overlap skips candidate and increments skippedConfirmedOverlaps.
// 5) planned overlap skips candidate and increments skippedPlannedOverlaps.