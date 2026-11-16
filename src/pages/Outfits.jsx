import { useMemo, useState } from 'react'
import { CalendarPlus, Heart, Layers, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { Chip, Collage, Empty, Field, ItemTile, Sheet } from '../ui'
import { OCCASION, OCCASIONS, prettyDate, ymd } from '../lib/constants'

export function OutfitCard({ outfit, onClick, meta }) {
  return (
    <button type="button" className="tile outfit" onClick={onClick}>
      <Collage layout={outfit.layout}>
        {outfit.favorite && <Heart className="tile-fav" size={14} fill="currentColor" />}
      </Collage>
      <div className="tile-text">
        <span className="tile-name">{outfit.name}</span>
        <span className="tile-meta">{meta ?? `${outfit.itemIds.length} prendas`}</span>
      </div>
    </button>
  )
}

export default function Outfits() {
  const { outfits, items, open, go } = useStore()
  const [filter, setFilter] = useState('all')
  const occasions = useMemo(() => OCCASIONS.filter((o) => outfits.some((x) => x.occasions?.includes(o.id))), [outfits])
  const hasFav = outfits.some((o) => o.favorite)
  const visible = outfits.filter((o) => filter === 'all' || (filter === 'fav' ? o.favorite : o.occasions?.includes(filter)))

  return (
    <div className="page">
      <header className="hello">
        <div>
          <p className="eyebrow">{outfits.length} {outfits.length === 1 ? 'guardado' : 'guardados'}</p>
          <h1>Outfits</h1>
        </div>
      </header>

      {outfits.length === 0 ? (
        <Empty icon={<Layers size={30} strokeWidth={1.4} />} title="Aún no tienes outfits"
          text={items.length < 2 ? 'Añade primero algunas prendas a tu armario.' : 'Combina tus prendas a mano o deja que el estilista te proponga ideas.'}>
          {items.length < 2
            ? <button className="btn" onClick={() => go('closet')}>Ir al armario</button>
            : <>
                <button className="btn" onClick={() => go('stylist')}><Sparkles size={17} /> Pedir ideas al estilista</button>
                <button className="btn ghost" onClick={() => open('outfitEdit', {})}>Crear a mano</button>
              </>}
        </Empty>
      ) : (
        <>
          {(hasFav || occasions.length > 0) && (
            <div className="chips scroll bleed">
              <Chip active={filter === 'all'} onClick={() => setFilter('all')}>Todos</Chip>
              {hasFav && <Chip active={filter === 'fav'} onClick={() => setFilter('fav')}>Favoritos</Chip>}
              {occasions.map((o) => <Chip key={o.id} active={filter === o.id} onClick={() => setFilter(o.id)}>{o.name}</Chip>)}
            </div>
          )}
          {visible.length === 0
            ? <Empty title="Sin resultados" text="Ningún outfit coincide con este filtro."><button className="btn ghost" onClick={() => setFilter('all')}>Ver todos</button></Empty>
            : <div className="grid outfits">
                {visible.map((o) => <OutfitCard key={o.id} outfit={o} onClick={() => open('outfit', { id: o.id })} />)}
              </div>}
          <button className="fab" onClick={() => open('outfitEdit', {})} aria-label="Crear outfit"><Plus size={20} /> <span>Crear</span></button>
        </>
      )}
    </div>
  )
}

/* ---------- Detalle de un outfit ---------- */
export function OutfitDetail({ id }) {
  const { outfits, itemMap, plans, open, close, saveOutfit, deleteOutfit, notify } = useStore()
  const outfit = outfits.find((o) => o.id === id)
  if (!outfit) return null
  const pieces = outfit.itemIds.map((i) => itemMap.get(i)).filter(Boolean)
  const today = ymd()
  const dates = plans.filter((p) => p.outfitId === id).map((p) => p.date).sort()
  const next = dates.find((d) => d >= today)
  const timesWorn = dates.filter((d) => d <= today).length

  const remove = () => open('confirm', {
    title: '¿Eliminar este outfit?',
    text: 'Tus prendas no se borran. No se puede deshacer.',
    onConfirm: async () => { close(2); await deleteOutfit(id); notify('Outfit eliminado') },
  })

  return (
    <Sheet title="Outfit"
      action={<>
        <button className="icon-btn" onClick={remove} aria-label="Eliminar outfit"><Trash2 size={18} /></button>
        <button className="icon-btn" onClick={() => open('outfitEdit', { outfit })} aria-label="Editar outfit"><Pencil size={18} /></button>
      </>}>
      <div className="detail-collage">
        <Collage layout={outfit.layout} />
        <button className={`heart ${outfit.favorite ? 'on' : ''}`} onClick={() => saveOutfit({ ...outfit, favorite: !outfit.favorite })}
          aria-label={outfit.favorite ? 'Quitar de favoritos' : 'Marcar como favorito'} aria-pressed={!!outfit.favorite}>
          <Heart size={19} fill={outfit.favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="detail-title">
        <h3>{outfit.name}</h3>
        <p>{[
          (outfit.occasions || []).map((o) => OCCASION[o]?.name).filter(Boolean).join(', '),
          timesWorn > 0 && `Usado ${timesWorn} ${timesWorn === 1 ? 'vez' : 'veces'}`,
          next && `Planificado: ${prettyDate(next).toLowerCase()}`,
        ].filter(Boolean).join(' · ')}</p>
      </div>
      {outfit.reason && <p className="notes">{outfit.reason}</p>}
      <div className="row-actions">
        <button className="btn block" onClick={() => open('plan', { outfit })}><CalendarPlus size={17} /> Planificar</button>
      </div>
      <section className="sub-section">
        <h4>{pieces.length} prendas</h4>
        <div className="grid compact">
          {pieces.map((item) => <ItemTile key={item.id} item={item} onClick={() => open('item', { id: item.id })} />)}
        </div>
      </section>
    </Sheet>
  )
}

/* ---------- Elegir día para un outfit ---------- */
export function PlanSheet({ outfit }) {
  const { plans, setPlan, close, notify } = useStore()
  const today = ymd()
  const tomorrow = (() => { const t = new Date(); t.setDate(t.getDate() + 1); return ymd(t) })()
  const [date, setDate] = useState(today)
  const taken = plans.find((p) => p.date === date)

  const confirm = async () => {
    await setPlan(date, outfit)
    notify(`Planificado para ${prettyDate(date).toLowerCase()}`)
    close()
  }
  return (
    <Sheet title="Planificar outfit" footer={<button className="btn block" onClick={confirm} disabled={!date}>Guardar en el calendario</button>}>
      <Field label="¿Qué día?">
        <div className="chips">
          <Chip active={date === today} onClick={() => setDate(today)}>Hoy</Chip>
          <Chip active={date === tomorrow} onClick={() => setDate(tomorrow)}>Mañana</Chip>
        </div>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Fecha" />
      </Field>
      {taken && <p className="hint">Ese día ya tiene un outfit{taken.name ? ` (${taken.name})` : ''}; se reemplazará.</p>}
    </Sheet>
  )
}

/* ---------- Elegir outfit para un día (desde el calendario) ---------- */
export function OutfitPicker({ date }) {
  const { outfits, setPlan, close, go, notify } = useStore()
  const choose = async (o) => { await setPlan(date, o); notify('Outfit planificado'); close() }
  return (
    <Sheet title={prettyDate(date).replace(/^\w/, (c) => c.toUpperCase())}>
      {outfits.length === 0 ? (
        <Empty icon={<Layers size={28} strokeWidth={1.4} />} title="No hay outfits guardados" text="Crea uno con el estilista y vuelve para planificarlo.">
          <button className="btn" onClick={() => { close(); go('stylist') }}><Sparkles size={17} /> Ir al estilista</button>
        </Empty>
      ) : (
        <>
          <p className="hint">Elige el outfit para este día.</p>
          <div className="grid outfits compact">
            {outfits.map((o) => <OutfitCard key={o.id} outfit={o} onClick={() => choose(o)} />)}
          </div>
        </>
      )}
    </Sheet>
  )
}
