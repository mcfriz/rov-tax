import type { AppState } from '../data/types'

type Props = {
  onClose: () => void
  onReset: () => void
  state: AppState
}

export default function SettingsModal({ onClose, onReset }: Props) {
  return (
    <div className="modal-scrim" role="dialog" aria-modal="true">
      <div className="modal-card">
        <header>
          <h3>Settings</h3>
          <button type="button" className="icon-button" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="modal-body">
          <section className="card">
            <h4>Reset demo data</h4>
            <p className="hint">Restores the seeded demo trips and overrides.</p>
            <button type="button" className="ghost-button" onClick={onReset}>
              Reset demo data
            </button>
          </section>
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