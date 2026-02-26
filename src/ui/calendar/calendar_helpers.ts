import type { DayKey, TripType } from '../../data/types'
import type { DerivedDay } from '../../rules/trip_engine'

export type DayStatus = 'qualifying' | 'non' | 'at-risk' | 'unknown'

export function parseDayKey(dayKey: DayKey): Date {
  const [year, month, day] = dayKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatDayKey(date: Date): DayKey {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

export function isDayInWindow(
  dayKey: DayKey,
  startDayKey: DayKey | null | undefined,
  endDayKey: DayKey | null | undefined,
): boolean {
  if (!startDayKey || !endDayKey) {
    return false
  }
  return dayKey >= startDayKey && dayKey <= endDayKey
}

export function getDayStatus(day: DerivedDay | undefined): DayStatus {
  if (!day || !day.tripType) {
    return 'unknown'
  }
  if (day.countsTowardSed) {
    return 'qualifying'
  }
  if (day.tripType === 'UK_HOME' || day.tripType === 'HOLIDAY_ABROAD') {
    return 'non'
  }
  return 'at-risk'
}

export function getTripStrip(tripType: TripType | null): string {
  if (!tripType) {
    return 'none'
  }
  if (tripType === 'OFFSHORE_WORK') {
    return 'ocean'
  }
  if (tripType === 'UK_HOME') {
    return 'home'
  }
  if (tripType === 'HOLIDAY_ABROAD') {
    return 'holiday'
  }
  return 'neutral'
}

export function getMonthTint(days: DerivedDay[]): 'offshore' | 'holiday' | 'none' {
  if (days.length === 0) {
    return 'none'
  }

  const offshore = days.filter((day) => day.tripType === 'OFFSHORE_WORK').length
  const holiday = days.filter((day) => day.tripType === 'HOLIDAY_ABROAD').length
  const total = days.filter((day) => day.tripType).length
  if (total === 0) {
    return 'none'
  }

  if (offshore / total > 0.5) {
    return 'offshore'
  }

  if (holiday / total > 0.5) {
    return 'holiday'
  }

  return 'none'
}

export function buildMonthDays(year: number, monthIndex: number): Array<DayKey | null> {
  const first = new Date(year, monthIndex, 1)
  const startWeekday = first.getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const result: Array<DayKey | null> = []

  for (let i = 0; i < startWeekday; i += 1) {
    result.push(null)
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    result.push(formatDayKey(new Date(year, monthIndex, day)))
  }

  while (result.length % 7 !== 0) {
    result.push(null)
  }

  return result
}
