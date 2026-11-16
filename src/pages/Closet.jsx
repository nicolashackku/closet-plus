import { useMemo, useRef, useState } from 'react'
import { Plus, Search, SlidersHorizontal, Shirt, X } from 'lucide-react'
import { useStore } from '../store'
import { Avatar, Chip, Chips, Empty, Field, ItemTile, Sheet, Spinner, Swatch } from '../ui'
import { CATEGORIES, CLIMATES, COLORS, OCCASIONS, uid } from '../lib/constants'
import { processImage } from '../lib/image'
import { aiTagItem } from '../lib/ai'

const SORTS = [
  { id: 'new', name: 'Recientes' },
  { id: 'most', name: 'Más usadas' },
  { id: 'least', name: 'Menos usadas' },
  { id: 'name', name: 'Nombre' },
]
const NO_FILTERS = { colors: [], climates: [], occasions: [], fav: false, review: false, sort: 'new' }

/** Subida de fotos: una abre el editor; varias se guardan de golpe para completarlas después. */
export function useAddItems() {
  const { open, saveItems, notify, settings } = useStore()
  const [busy, setBusy] = useState(null)
  const inputRef = useRef()

  const onFiles = async (e) => {
    const files = [...(e.target.files || [])].filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))
    e.target.value = ''
    if (!files.length) return
    try {
      if (files.length === 1) {
        setBusy('Preparando foto…')
        const draft = await processImage(files[0])
        open('itemEdit', { draft })
        return
      }
      const created = []
      for (let i = 0; i < files.length; i++) {
        setBusy(`Añadiendo ${i + 1} de ${files.length}…`)
        try {
          const { blob, colors, transparent } = await processImage(files[i])
          let tags = {}
          if (settings.geminiKey) { try { tags = await aiTagItem(blob, settings) } catch { /* se completa a mano */ } }
          created.push({
            id: uid(), name: tags.name || 'Prenda nueva', category: tags.category || 'tops', sub: tags.sub || '',
            colors: tags.colors?.length ? tags.colors : colors, climates: tags.climates || [], occasions: tags.occasions || [],
            brand: tags.brand || '', size: '', price: '', notes: '', favorite: false, wornDates: [],
            image: blob, cutout: transparent, needsReview: !tags.category, createdAt: Date.now() + i,
          })
        } catch { /* foto ilegible: la saltamos */ }
      }
      if (created.length) await saveItems(created)
      const skipped = files.length - created.length
      notify(created.length
        ? `${created.length} prendas añadidas${skipped ? ` (${skipped} no se pudieron leer)` : ''}`
        : 'No se pudo leer ninguna foto')
    } catch {
      notify('No se pudo leer la foto')
    } finally {
      setBusy(null)
    }
  }

  const input = <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
  return { input, busy, pick: () => inputRef.current?.click() }
}

export default function Closet() {
  const { items, profile, open, go, wear, loadSamples, notify } = useStore()
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState(NO_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [loadingSamples, setLoadingSamples] = useState(false)
  const add = useAddItems()

  const activeFilters = filters.colors.length + filters.climates.length + filters.occasions.length + (filters.fav ? 1 : 0) + (filters.review ? 1 : 0)
  const reviewCount = items.filter((i) => i.needsReview).length

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    const uses = (i) => wear[i.id]?.count || 0
    const list = items.filter((i) => {
      if (cat !== 'all' && i.category !== cat) return false
      if (filters.fav && !i.favorite) return false
      if (filters.review && !i.needsReview) return false
      if (filters.colors.length && !filters.colors.some((c) => i.colors?.includes(c))) return false
      if (filters.climates.length && !filters.climates.some((c) => i.climates?.includes(c))) return false
      if (filters.occasions.length && !filters.occasions.some((c) => i.occasions?.includes(c))) return false
      if (term && ![i.name, i.sub, i.brand, i.notes].some((t) => t?.toLowerCase().includes(term))) return false
      return true
    })
    if (filters.sort === 'most') list.sort((a, b) => uses(b) - uses(a))
    if (filters.sort === 'least') list.sort((a, b) => uses(a) - uses(b))
    if (filters.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'es'))
    return list
  }, [items, cat, q, filters, wear])

  const counts = useMemo(() => {
    const c = {}
    items.forEach((i) => { c[i.category] = (c[i.category] || 0) + 1 })
    return c
  }, [items])

  const samples = async () => {
    setLoadingSamples(true)
    try { notify(`${await loadSamples()} prendas de ejemplo añadidas`) } finally { setLoadingSamples(false) }
  }

  return (
    <div className="page">
      {add.input}
      <header className="hello">
        <div>
          <p className="eyebrow">{profile.name ? `Hola, ${profile.name}` : 'Hola'}</p>
          <h1>Mi armario</h1>
        </div>
        <button className="avatar-btn" onClick={() => go('profile')} aria-label="Perfil"><Avatar size={44} /></button>
      </header>

      {items.length === 0 ? (
        <Empty icon={<Shirt size={30} strokeWidth={1.4} />} title="Tu armario está vacío"
          text="Sube fotos de tu ropa para empezar. Puedes elegir varias a la vez.">
          <button className="btn" onClick={add.pick} disabled={!!add.busy}>
            {add.busy ? <><Spinner /> {add.busy}</> : <><Plus size={18} /> Añadir prendas</>}
          </button>
          <button className="btn ghost" onClick={samples} disabled={loadingSamples}>
            {loadingSamples ? <><Spinner /> Cargando…</> : 'Probar con un armario de ejemplo'}
          </button>
        </Empty>
      ) : (
        <>
          <div className="toolbar">
            <label className="search">
              <Search size={17} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en tu armario" aria-label="Buscar" />
              {q && <button className="clear" onClick={() => setQ('')} aria-label="Borrar búsqueda"><X size={15} /></button>}
            </label>
            <button className={`icon-btn boxed ${activeFilters ? 'on' : ''}`} onClick={() => setShowFilters(true)} aria-label="Filtros">
              <SlidersHorizontal size={18} />
              {activeFilters > 0 && <span className="badge">{activeFilters}</span>}
            </button>
          </div>

          <div className="chips scroll bleed">
            <Chip active={cat === 'all'} onClick={() => setCat('all')}>Todo <small>{items.length}</small></Chip>
            {CATEGORIES.filter((c) => counts[c.id]).map((c) => (
              <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.short} <small>{counts[c.id]}</small></Chip>
            ))}
          </div>

          {reviewCount > 0 && !filters.review && (
            <button className="notice" onClick={() => setFilters({ ...filters, review: true })}>
              <span className="tile-dot static" /> {reviewCount} {reviewCount === 1 ? 'prenda por completar' : 'prendas por completar'}
              <span className="notice-link">Ver</span>
            </button>
          )}

          {visible.length === 0 ? (
            <Empty title="Sin resultados" text="Ninguna prenda coincide con la búsqueda o los filtros.">
              <button className="btn ghost" onClick={() => { setQ(''); setCat('all'); setFilters(NO_FILTERS) }}>Quitar filtros</button>
            </Empty>
          ) : (
            <div className="grid">
              {visible.map((item) => (
                <ItemTile key={item.id} item={item} onClick={() => open('item', { id: item.id })}
                  meta={filters.sort === 'most' || filters.sort === 'least' ? `${wear[item.id]?.count || 0} usos` : undefined} />
              ))}
            </div>
          )}

          <button className="fab" onClick={add.pick} disabled={!!add.busy} aria-label="Añadir prendas">
            {add.busy ? <><Spinner /> <span>{add.busy}</span></> : <><Plus size={20} /> <span>Añadir</span></>}
          </button>
        </>
      )}

      {showFilters && (
        <Sheet title="Filtros" onClose={() => setShowFilters(false)}
          action={activeFilters > 0 && <button className="link" onClick={() => setFilters({ ...NO_FILTERS, sort: filters.sort })}>Limpiar</button>}
          footer={<button className="btn block" onClick={() => setShowFilters(false)}>Ver {visible.length} {visible.length === 1 ? 'prenda' : 'prendas'}</button>}>
          <Field label="Ordenar por">
            <Chips options={SORTS} value={filters.sort} allowNone={false} onChange={(sort) => setFilters({ ...filters, sort })} />
          </Field>
          <Field label="Mostrar">
            <div className="chips">
              <Chip active={filters.fav} onClick={() => setFilters({ ...filters, fav: !filters.fav })}>Solo favoritas</Chip>
              {reviewCount > 0 && <Chip active={filters.review} onClick={() => setFilters({ ...filters, review: !filters.review })}>Por completar</Chip>}
            </div>
          </Field>
          <Field label="Color">
            <div className="chips">
              {COLORS.map((c) => (
                <Chip key={c.id} active={filters.colors.includes(c.id)}
                  onClick={() => setFilters({ ...filters, colors: filters.colors.includes(c.id) ? filters.colors.filter((x) => x !== c.id) : [...filters.colors, c.id] })}>
                  <Swatch id={c.id} /> {c.name}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Clima">
            <Chips multi options={CLIMATES} value={filters.climates} onChange={(climates) => setFilters({ ...filters, climates })} />
          </Field>
          <Field label="Ocasión">
            <Chips multi options={OCCASIONS} value={filters.occasions} onChange={(occasions) => setFilters({ ...filters, occasions })} />
          </Field>
        </Sheet>
      )}
    </div>
  )
}
