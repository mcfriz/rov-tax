import type { AppState, DayOverride } from './types'
import { createTrip, toDayKey } from './helpers'

const demoTrips = [
  createTrip({
    title: 'North Sea Rotation',
    tripType: 'OFFSHORE_WORK',
    startDayKey: '2026-02-10',
    endDayKey: '2026-02-20',
    vessel: 'Northwind 7',
    sectorDefault: 'UK_OUTSIDE_12NM',
    dutyDefault: 'OFFSHORE',
    countsTowardSedDefault: true,
    planned: false,
  }),
  createTrip({
    title: 'UK Home Block',
    tripType: 'UK_HOME',
    startDayKey: '2026-02-01',
    endDayKey: '2026-02-07',
    sectorDefault: 'OTHER',
    dutyDefault: 'LEAVE',
    countsTowardSedDefault: false,
    planned: false,
  }),
  createTrip({
    title: 'Holiday Abroad',
    tripType: 'HOLIDAY_ABROAD',
    startDayKey: '2025-12-15',
    endDayKey: '2025-12-22',
    sectorDefault: 'OTHER',
    dutyDefault: 'LEAVE',
    countsTowardSedDefault: false,
    planned: false,
  }),
  createTrip({
    title: 'Norway Sector Rotation',
    tripType: 'OFFSHORE_WORK',
    startDayKey: '2026-02-15',
    endDayKey: '2026-02-25',
    vessel: 'Arctic Pioneer',
    sectorDefault: 'NORWAY',
    dutyDefault: 'OFFSHORE',
    countsTowardSedDefault: true,
    planned: true,
  }),
]

const demoOverrides: Record<string, DayOverride> = {
  '2026-02-12': {
    dayKey: '2026-02-12',
    midnightLocation: 'INSIDE_12NM_UK',
    dutyType: 'OFFSHORE',
    countsTowardSed: false,
    vessel: 'Northwind 7',
    notes: 'Weather hold inside 12nm for inspection.',
    lastEdited: Date.now() - 1000 * 60 * 60 * 5,
  },
  '2026-02-18': {
    dayKey: '2026-02-18',
    midnightLocation: 'INSIDE_12NM_UK',
    dutyType: 'TRANSIT',
    countsTowardSed: false,
    vessel: 'Northwind 7',
    notes: 'Transit day brought inside 12nm.',
    lastEdited: Date.now() - 1000 * 60 * 60 * 2,
  },
}

export const defaultState: AppState = {
  selectedDate: toDayKey(new Date()),
  calendarZoom: 'MONTH',
  trips: demoTrips,
  overrides: demoOverrides,
  settings: {
    taxYearStart: '06-04',
    selectedPeriodStart: null,
  },
}