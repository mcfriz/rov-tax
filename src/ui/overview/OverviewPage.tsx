import type { Dispatch, SetStateAction } from 'react'
import type { AppState } from '../../data/types'
import OverviewTab from './overview_tab'

type Props = {
  state: AppState
  onChange: Dispatch<SetStateAction<AppState>>
}

export default function OverviewPage({ state, onChange }: Props) {
  return <OverviewTab state={state} onChange={onChange} />
}
