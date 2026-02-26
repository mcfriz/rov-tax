import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { loadState, saveState } from './data/storage'
import { defaultState } from './data/state'
import type { AppState, TabId } from './data/types'
import CalendarPage from './ui/calendar/CalendarPage'
import TripsPage from './ui/trips/TripsPage'
import OverviewPage from './ui/overview/OverviewPage'
import ReportsPage from './ui/reports/ReportsPage'
import { generateDayMap } from './rules/trip_engine'
import SettingsModal from './ui/SettingsModal'

type TabDef = {
  id: TabId
  label: string
  component: (props: TabPageProps) => JSX.Element
}

type TabPageProps = {
  appState: AppState
  setAppState: (next: AppState) => void
}

function App() {
  const [appState, setAppState] = useState(() => loadState())
  const [activeTab, setActiveTab] = useState<TabId>('trips')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  useEffect(() => {
    saveState(appState)
  }, [appState])

  useEffect(() => {
    generateDayMap(appState.trips, appState.overrides)
  }, [appState.trips, appState.overrides])

  const tabs = useMemo<TabDef[]>(
    () => [
      {
        id: 'calendar',
        label: 'Calendar',
        component: ({ appState: state, setAppState: setState }) => (
          <CalendarPage state={state} onChange={setState} />
        ),
      },
      {
        id: 'trips',
        label: 'Trips',
        component: ({ appState: state, setAppState: setState }) => (
          <TripsPage state={state} onChange={setState} />
        ),
      },
      {
        id: 'overview',
        label: 'Overview',
        component: ({ appState: state, setAppState: setState }) => (
          <OverviewPage state={state} onChange={setState} />
        ),
      },
      {
        id: 'reports',
        label: 'Reports',
        component: ({ appState: state, setAppState: setState }) => (
          <ReportsPage state={state} onChange={setState} />
        ),
      },
    ],
    [],
  )

  const handleTabChange = (nextTab: TabId) => {
    setActiveTab(nextTab)
  }

  const handleResetDemo = () => {
    setAppState(defaultState)
    saveState(defaultState)
    setIsSettingsOpen(false)
  }

  return (
    <div className="app-shell">
      <header className="app-bar">
        <div className="app-title">ROV TAX</div>
        <div className="app-actions">
          <button type="button" className="ghost-button" onClick={() => setIsSettingsOpen(true)}>
            Settings
          </button>
        </div>
      </header>

      <main className="app-main" role="tabpanel">
        {tabs.map(({ id, component: TabComponent }) => (
          <section
            key={id}
            className={`tab-panel${activeTab === id ? ' is-active' : ''}`}
            aria-hidden={activeTab !== id}
          >
            <TabComponent appState={appState} setAppState={setAppState} />
          </section>
        ))}
      </main>

      <nav className="tab-bar" role="tablist" aria-label="Primary">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`tab-button${activeTab === id ? ' is-active' : ''}`}
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => handleTabChange(id)}
          >
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {isSettingsOpen ? (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} onReset={handleResetDemo} state={appState} />
      ) : null}
    </div>
  )
}

export default App