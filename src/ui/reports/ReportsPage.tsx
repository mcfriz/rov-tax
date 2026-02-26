import type { AppState } from '../../data/types'
import ReportsTab from './reports_tab'

type Props = {
  state: AppState
  onChange: (next: AppState) => void
}

export default function ReportsPage({ state, onChange }: Props) {
  return <ReportsTab state={state} onChange={onChange} />
}