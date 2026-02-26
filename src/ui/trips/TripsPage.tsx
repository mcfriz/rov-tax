import type { Dispatch, SetStateAction } from 'react'
import type { AppState } from '../../data/types'
import TripsTab from './trips_tab'

type Props = {
  state: AppState
  onChange: Dispatch<SetStateAction<AppState>>
}

export default function TripsPage({ state, onChange }: Props) {
  return <TripsTab state={state} onChange={onChange} />
}
