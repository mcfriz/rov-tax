export type TabId = 'calendar' | 'trips' | 'overview' | 'reports'

export type DayKey = string

export type TripType =
  | 'OFFSHORE_WORK'
  | 'UK_HOME'
  | 'HOLIDAY_ABROAD'
  | 'TRAINING_ABROAD'
  | 'TRANSIT'
  | 'UK_WATERS_WORK'

export type MidnightLocation =
  | 'OUTSIDE_UK'
  | 'INSIDE_12NM_UK'
  | 'NORWAY_SECTOR'
  | 'UNKNOWN'

export type DutyType = 'OFFSHORE' | 'LEAVE' | 'TRANSIT' | 'TRAINING' | 'SICK' | 'OTHER'

export type SectorDefault = 'UK_OUTSIDE_12NM' | 'UK_INSIDE_12NM' | 'NORWAY' | 'OTHER'

export type CalendarZoom = 'YEAR' | 'MONTH' | 'DAY'

export interface Trip {
  id: string
  title: string
  tripType: TripType
  startDayKey: DayKey
  endDayKey: DayKey
  vessel?: string
  sectorDefault: SectorDefault
  dutyDefault: DutyType
  countsTowardSedDefault: boolean
  createdAt: string
  updatedAt: string
  planned: boolean
  colourTag: string
}

export interface DayOverride {
  dayKey: DayKey
  midnightLocation?: MidnightLocation
  dutyType?: DutyType
  countsTowardSed?: boolean
  vessel?: string
  notes?: string
  source?: 'MIXED_TRIP'
  lastEdited: number
}

export interface Settings {
  taxYearStart: string
  selectedPeriodStart: DayKey | null
}

export interface AppState {
  selectedDate: DayKey
  calendarZoom: CalendarZoom
  trips: Trip[]
  overrides: Record<DayKey, DayOverride>
  settings: Settings
}
