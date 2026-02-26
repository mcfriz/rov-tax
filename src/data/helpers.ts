import type { DayKey, Trip, TripType } from './types'

const tripColours: Record<TripType, string> = {
  OFFSHORE_WORK: 'ocean',
  UK_HOME: 'home',
  HOLIDAY_ABROAD: 'holiday',
  TRAINING_ABROAD: 'training',
  TRANSIT: 'transit',
  UK_WATERS_WORK: 'uk-waters',
}

export function toDayKey(date: Date): DayKey {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function deriveTripColour(tripType: TripType): string {
  return tripColours[tripType]
}

export function createTrip(partial: Omit<Trip, 'id' | 'createdAt' | 'updatedAt' | 'colourTag'>): Trip {
  const timestamp = nowIso()
  return {
    ...partial,
    id: getUuid(),
    createdAt: timestamp,
    updatedAt: timestamp,
    colourTag: deriveTripColour(partial.tripType),
  }
}

export function getUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `rov-${Math.random().toString(16).slice(2)}-${Date.now()}`
}