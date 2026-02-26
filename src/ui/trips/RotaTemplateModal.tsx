import { useMemo, useState } from 'react'
import type { DayKey, SectorDefault } from '../../data/types'
import { toDayKey } from '../../data/helpers'

type Props = {
  onClose: () => void
  onSave: (payload: {
    startDayKey: DayKey
    onWeeks: number
    offWeeks: number
    cycles?: number
    endDayKey?: DayKey
    defaultVessel?: string
    offshoreSector: SectorDefault
  }) => void
  defaultSector: SectorDefault
}

const sectorOptions: Array<{ value: SectorDefault; label: string }> = [
  { value: 'UK_OUTSIDE_12NM', label: 'Outside UK' },
  { value: 'NORWAY', label: 'Norway' },
  { value: 'OTHER', label: 'Unknown' },
]

function getFutureDayKey(daysAhead: number): DayKey {
  const today = new Date()
  today.setDate(today.getDate() + daysAhead)
  return toDayKey(today)
}

function parseDayKey(dayKey: DayKey): Date {
  const [year, month, day] = dayKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

type Mode = 'months' | 'cycles'

export default function RotaTemplateModal({ onClose, onSave, defaultSector }: Props) {
  const defaultStart = useMemo(() => getFutureDayKey(3), [])
  const [startDayKey, setStartDayKey] = useState<DayKey>(defaultStart)
  const [onWeeks, setOnWeeks] = useState(4)
  const [offWeeks, setOffWeeks] = useState(4)
  const [mode, setMode] = useState<Mode>('months')
  const [monthsAhead, setMonthsAhead] = useState(12)
  const [cycles, setCycles] = useState(4)
  const [defaultVessel, setDefaultVessel] = useState('')
  const [offshoreSector, setOffshoreSector] = useState<SectorDefault>(defaultSector)

  const endDayKey = useMemo(() => {
    if (mode !== 'months') {
      return undefined
    }

    const start = parseDayKey(startDayKey)
    const end = new Date(start)
    end.setMonth(end.getMonth() + monthsAhead)
    return toDayKey(end)
  }, [mode, monthsAhead, startDayKey])

  const handleSave = () => {
    onSave({
      startDayKey,
      onWeeks: Math.max(1, onWeeks),
      offWeeks: Math.max(1, offWeeks),
      cycles: mode === 'cycles' ? Math.max(1, cycles) : undefined,
      endDayKey: mode === 'months' ? endDayKey : undefined,
      defaultVessel: defaultVessel.trim() || undefined,
      offshoreSector,
    })
  }

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true">
      <div className="modal-card">
        <header>
          <h3>Add Rota Template</h3>
          <button type="button" className="icon-button" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="modal-body">
          <label>
            Template Start Date
            <input type="date" value={startDayKey} onChange={(event) => setStartDayKey(event.target.value)} />
          </label>

          <div className="date-row">
            <label>
              On Weeks
              <input
                type="number"
                min={1}
                value={onWeeks}
                onChange={(event) => setOnWeeks(Number(event.target.value))}
              />
            </label>
            <label>
              Off Weeks
              <input
                type="number"
                min={1}
                value={offWeeks}
                onChange={(event) => setOffWeeks(Number(event.target.value))}
              />
            </label>
          </div>

          <label>
            Generate By
            <select value={mode} onChange={(event) => setMode(event.target.value as Mode)}>
              <option value="months">Generate next N months</option>
              <option value="cycles">Generate cycles</option>
            </select>
          </label>

          {mode === 'months' ? (
            <label>
              Months Ahead
              <input
                type="number"
                min={1}
                value={monthsAhead}
                onChange={(event) => setMonthsAhead(Number(event.target.value))}
              />
            </label>
          ) : (
            <label>
              Cycles
              <input
                type="number"
                min={1}
                value={cycles}
                onChange={(event) => setCycles(Number(event.target.value))}
              />
            </label>
          )}

          <label>
            Default Vessel (optional)
            <input type="text" value={defaultVessel} onChange={(event) => setDefaultVessel(event.target.value)} />
          </label>

          <label>
            Offshore Sector Default
            <select
              value={offshoreSector}
              onChange={(event) => setOffshoreSector(event.target.value as SectorDefault)}
            >
              {sectorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <footer>
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={handleSave}>
            Generate
          </button>
        </footer>
      </div>
    </div>
  )
}
