import type { AppState } from './types'
import { toDayKey } from './helpers'

export const defaultState: AppState = {
  selectedDate: toDayKey(new Date()),
  calendarZoom: 'MONTH',
  trips: [],
  overrides: {},
  settings: {
    taxYearStart: '06-04',
    selectedPeriodStart: null,
  },
}
