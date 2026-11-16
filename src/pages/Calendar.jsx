import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react'
import { useStore } from '../store'
import { Collage, ItemTile } from '../ui'
import { MONTHS, WEEKDAYS, prettyDate, ymd } from '../lib/constants'

export default function Calendar() {
  const { plans, outfits, itemMap, open, go, setPlan, notify } = useStore()
  const today = ymd()
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [selected, setSelected] = useState(today)
  const planMap = useMemo(() => new Map(plans.map((p) => [p.date, p])), [plans])

  const cells = useMemo(() => {
    const y = cursor.getFullYear(), m = cursor.getMonth()
    const lead = (new Date(y, m, 1).getDay() + 6) % 7 // semana empieza en lunes
    const days = new Date(y, m + 1, 0).getDate()
    return [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => ymd(new Date(y, m, i + 1)))]
  }, [cursor])

  const shift = (n) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1))
  const goToday = () => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(today) }
  const monthCount = cells.filter((c) => c && planMap.has(c)).length
  const isCurrentMonth = cells.includes(today)

  const plan = planMap.get(selected)
  const planLayout = plan?.layout.filter((l) => itemMap.has(l.itemId)) || []
  const pieces = plan ? plan.itemIds.map((i) => itemMap.get(i)).filter(Boolean) : []
  const linked = plan?.outfitId && outfits.find((o) => o.id === plan.outfitId)
  const past = selected < today

  return (
    <div className="page">
      <header className="hello">
        <div>
          <p className="eyebrow">{monthCount} {monthCount === 1 ? 'día con outfit' : 'días con outfit'} este mes</p>
          <h1>Calendario</h1>
        </div>
      </header>

      <div className="cal-layout">
        <section className="cal">
          <div className="cal-head">
            <button className="icon-btn" onClick={() => shift(-1)} aria-label="Mes anterior"><ChevronLeft size={20} /></button>
            <h2>{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</h2>
            <button className="icon-btn" onClick={() => shift(1)} aria-label="Mes siguiente"><ChevronRight size={20} /></button>
            {!isCurrentMonth && <button className="link cal-today" onClick={goToday}>Hoy</button>}
          </div>
          <div className="cal-grid cal-week">{WEEKDAYS.map((d) => <span key={d}>{d}</span>)}</div>
          <div className="cal-grid">
            {cells.map((date, i) => {
              if (!date) return <span key={`e${i}`} />
              const p = planMap.get(date)
              return (
                <button key={date} className={`cal-day ${date === selected ? 'sel' : ''} ${date === today ? 'today' : ''} ${p ? 'has' : ''}`}
                  onClick={() => setSelected(date)} aria-label={`${prettyDate(date)}${p ? ', con outfit' : ''}`} aria-pressed={date === selected}>
                  {p && <Collage layout={p.layout} />}
                  <b>{Number(date.slice(8))}</b>
                </button>
              )
            })}
          </div>
        </section>

        <section className="day">
          <h3>{prettyDate(selected).replace(/^\w/, (c) => c.toUpperCase())}</h3>
          {plan ? (
            <>
              <div className="day-plan">
                <Collage layout={planLayout} />
                <div className="day-info">
                  <b>{plan.name || 'Outfit del día'}</b>
                  <span>{pieces.length} prendas</span>
                  <div className="day-actions">
                    {linked && <button className="btn ghost sm" onClick={() => open('outfit', { id: linked.id })}>Ver outfit</button>}
                    <button className="btn ghost sm" onClick={() => open('outfitPick', { date: selected })}>Cambiar</button>
                    <button className="btn ghost sm" onClick={async () => { await setPlan(selected, null); notify('Día liberado') }}>Quitar</button>
                  </div>
                </div>
              </div>
              <div className="hscroll">
                {pieces.map((item) => <ItemTile key={item.id} small item={item} onClick={() => open('item', { id: item.id })} />)}
              </div>
            </>
          ) : (
            <div className="day-empty">
              <p>{past ? '¿Qué te pusiste este día? Regístralo para llevar la cuenta de tus usos.' : 'Todavía no hay nada planificado.'}</p>
              <div className="day-actions">
                <button className="btn sm" onClick={() => open('outfitPick', { date: selected })}><Plus size={16} /> Elegir outfit</button>
                {!past && <button className="btn ghost sm" onClick={() => go('stylist')}><Sparkles size={15} /> Pedir ideas</button>}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
