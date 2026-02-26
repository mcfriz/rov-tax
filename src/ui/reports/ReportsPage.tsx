import type { Dispatch, SetStateAction } from 'react'
import type { AppState } from '../../data/types'
import ReportsTab from './reports_tab'

type Props = {
  state: AppState
  onChange: Dispatch<SetStateAction<AppState>>
}

export default function ReportsPage({ state, onChange }: Props) {
  return <ReportsTab state={state} onChange={onChange} />
}
