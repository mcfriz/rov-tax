import type { AppState } from './types'
import { defaultState } from './state'

const STORAGE_KEY = 'rov-tax-state-v2'
const STORAGE_VERSION = 1

type StoragePayload = {
  version: number
  state: AppState
}

function mergeState(partial: Partial<AppState>): AppState {
  return {
    ...defaultState,
    ...partial,
    settings: {
      ...defaultState.settings,
      ...partial.settings,
    },
    overrides: {
      ...defaultState.overrides,
      ...partial.overrides,
    },
    trips: partial.trips ?? defaultState.trips,
  }
}

export function loadState(): AppState {
  if (typeof window === 'undefined') {
    return defaultState
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return defaultState
    }

    const parsed = JSON.parse(raw) as StoragePayload | AppState

    if ('version' in parsed && 'state' in parsed) {
      if (parsed.version !== STORAGE_VERSION) {
        return mergeState(parsed.state)
      }
      return mergeState(parsed.state)
    }

    return mergeState(parsed)
  } catch {
    return defaultState
  }
}

export function saveState(state: AppState) {
  if (typeof window === 'undefined') {
    return
  }

  const payload: StoragePayload = {
    version: STORAGE_VERSION,
    state,
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore storage errors (quota, privacy mode, etc.)
  }
}