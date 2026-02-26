import { useEffect } from 'react'
import type { DayKey, DayOverride } from '../../data/types'
import type { DerivedDay } from '../../rules/trip_engine'
import DayOverrideEditor from './DayOverrideEditor'

type Props = {
  dayKey: DayKey
  base?: DerivedDay
  override?: DayOverride
  onClose: () => void
  onSave: (dayKey: DayKey, override: DayOverride | null) => void
}

export default function DayOverrideModal({ dayKey, base, override, onClose, onSave }: Props) {
  useEffect(() => {
    document.body.classList.add('modal-open')
    return () => {
      document.body.classList.remove('modal-open')
    }
  }, [])

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true">
      <div className="modal-card">
        <header>
          <h3>Override {dayKey}</h3>
          <button type="button" className="icon-button" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="modal-body">
          <DayOverrideEditor dayKey={dayKey} base={base} override={override} onSave={onSave} />
        </div>

        <footer>
          <button type="button" className="ghost-button" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  )
}
