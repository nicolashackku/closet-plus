import { useRef, useState } from 'react'
import { Check, Eraser, Heart, ImagePlus, Pencil, Sparkles, Trash2, Undo2, Wand } from 'lucide-react'
import { useStore } from '../store'
import { Chip, Chips, Collage, Field, Pic, Sheet, Spinner, Swatch } from '../ui'
import { CAT, CATEGORIES, CLIMATE, CLIMATES, COLOR, COLORS, OCCASION, OCCASIONS, money, shortDate, uid, ymd } from '../lib/constants'
import { processImage, removeBackground } from '../lib/image'
import { aiTagItem } from '../lib/ai'

/* ---------- Detalle de una prenda ---------- */
export function ItemDetail({ id }) {
  const { itemMap, outfits, wear, open, close, go, saveItem, toggleWornToday, notify } = useStore()
  const item = itemMap.get(id)
  if (!item) return null
  const w = wear[id] || { count: 0 }
  const wornToday = w.last === ymd()
  const price = Number(item.price) || 0
  const used = outfits.filter((o) => o.itemIds.includes(id))

  return (
    <Sheet title={CAT[item.category]?.name || 'Prenda'}
      action={<button className="icon-btn" onClick={() => open('itemEdit', { id })} aria-label="Editar"><Pencil size={18} /></button>}>
      <div className="detail-img">
        <Pic item={item} />
        <button className={`heart ${item.favorite ? 'on' : ''}`} onClick={() => saveItem({ ...item, favorite: !item.favorite })}
          aria-label={item.favorite ? 'Quitar de favoritas' : 'Marcar como favorita'} aria-pressed={!!item.favorite}>
          <Heart size={19} fill={item.favorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="detail-title">
        <h3>{item.name}</h3>
        <p>{[item.sub, item.brand, item.size && `Talla ${item.size}`].filter(Boolean).join(' · ')}</p>
      </div>

      {item.needsReview && (
        <button className="notice" onClick={() => open('itemEdit', { id })}>
          <span className="tile-dot static" /> Faltan datos de esta prenda <span className="notice-link">Completar</span>
        </button>
      )}

      <div className="stats three">
        <div><b>{w.count}</b><span>{w.count === 1 ? 'uso' : 'usos'}</span></div>
        <div><b>{w.last ? shortDate(w.last) : '—'}</b><span>último uso</span></div>
        <div><b>{price && w.count ? money(price / w.count) : price ? money(price) : '—'}</b><span>{price && w.count ? 'coste por uso' : 'precio'}</span></div>
      </div>

      <div className="row-actions">
        <button className={`btn ${wornToday ? '' : 'ghost'}`} onClick={async () => notify((await toggleWornToday(item)) ? 'Uso de hoy registrado' : 'Uso de hoy quitado')}>
          <Check size={17} /> {wornToday ? 'Usada hoy' : 'La usé hoy'}
        </button>
        <button className="btn" onClick={() => { close(); go('stylist', { baseItemId: id }) }}>
          <Sparkles size={17} /> Crear outfit
        </button>
      </div>

      <div className="tags">
        {(item.colors || []).map((c) => COLOR[c] && <span key={c} className="tag"><Swatch id={c} /> {COLOR[c].name}</span>)}
        {(item.climates || []).map((c) => CLIMATE[c] && <span key={c} className="tag">{CLIMATE[c].name}</span>)}
        {(item.occasions || []).map((c) => OCCASION[c] && <span key={c} className="tag">{OCCASION[c].name}</span>)}
      </div>

      {item.notes && <p className="notes">{item.notes}</p>}

      {used.length > 0 && (
        <section className="sub-section">
          <h4>En {used.length} {used.length === 1 ? 'outfit' : 'outfits'}</h4>
          <div className="hscroll">
            {used.map((o) => (
              <button key={o.id} className="mini-outfit" onClick={() => open('outfit', { id: o.id })}>
                <Collage layout={o.layout} />
                <span>{o.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </Sheet>
  )
}

/* ---------- Añadir / editar prenda ---------- */
export function ItemEditor({ id, draft }) {
  const { itemMap, saveItem, deleteItem, open, close, notify, settings, overlays } = useStore()
  const existing = id ? itemMap.get(id) : null
  const [form, setForm] = useState(() => existing
    ? { ...existing }
    : { name: '', category: null, sub: '', colors: draft.colors || [], climates: [], occasions: [], brand: '', size: '', price: '', notes: '', image: draft.blob, cutout: draft.transparent })
  const [original, setOriginal] = useState(null) // { image, cutout } antes de quitar el fondo
  const [work, setWork] = useState(null) // { label, pct }
  const [error, setError] = useState('')
  const fileRef = useRef()
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const cutout = async () => {
    setError('')
    setWork({ label: 'Preparando', pct: 0 })
    try {
      const res = await removeBackground(form.image, (label, pct) => setWork({ label, pct }))
      setOriginal({ image: form.image, cutout: form.cutout })
      set({ image: res.blob, cutout: res.transparent, colors: res.colors.length ? res.colors : form.colors })
    } catch (e) {
      console.error(e)
      setError('No se pudo quitar el fondo. La primera vez hace falta internet para descargar el modelo.')
    } finally {
      setWork(null)
    }
  }

  const autoTag = async () => {
    setError('')
    setWork({ label: 'Analizando la prenda' })
    try {
      const t = await aiTagItem(form.image, settings)
      set({
        name: form.name || t.name || '', category: t.category || form.category, sub: t.sub || form.sub,
        colors: t.colors.length ? t.colors : form.colors,
        climates: t.climates.length ? t.climates : form.climates,
        occasions: t.occasions.length ? t.occasions : form.occasions,
        brand: form.brand || t.brand || '',
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setWork(null)
    }
  }

  const replacePhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const res = await processImage(file)
      setOriginal(null)
      set({ image: res.blob, cutout: res.transparent, colors: res.colors.length ? res.colors : form.colors })
    } catch { setError('No se pudo leer la foto.') }
  }

  const save = async () => {
    if (!form.category) { setError('Elige una categoría para guardar la prenda.'); return }
    const item = {
      id: existing?.id || uid(), favorite: false, wornDates: [], createdAt: Date.now(),
      ...form,
      name: form.name.trim() || form.sub || CAT[form.category].one,
      brand: form.brand.trim(), size: String(form.size).trim(), notes: form.notes.trim(),
      price: form.price === '' ? '' : Math.max(0, Number(form.price) || 0),
      needsReview: false,
    }
    await saveItem(item)
    notify(existing ? 'Cambios guardados' : 'Prenda añadida')
    close()
  }

  const remove = () => open('confirm', {
    title: '¿Eliminar esta prenda?',
    text: 'También se quitará de los outfits donde aparece. No se puede deshacer.',
    onConfirm: async () => {
      // Cerramos la confirmación, el editor y el detalle que haya debajo.
      const below = overlays[overlays.length - 2]?.type === 'item' ? 1 : 0
      close(2 + below)
      await deleteItem(existing.id)
      notify('Prenda eliminada')
    },
  })

  const subs = form.category ? CAT[form.category].subs : []
  const toggleColor = (c) => set({ colors: form.colors.includes(c) ? form.colors.filter((x) => x !== c) : [...form.colors, c].slice(-3) })

  return (
    <Sheet full title={existing ? 'Editar prenda' : 'Nueva prenda'}
      footer={<button className="btn block" onClick={save} disabled={!!work}>{existing ? 'Guardar cambios' : 'Añadir al armario'}</button>}
      action={existing && <button className="icon-btn" onClick={remove} aria-label="Eliminar prenda"><Trash2 size={18} /></button>}>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={replacePhoto} />

      <div className="editor-img">
        <Pic item={form} />
        {work && (
          <div className="img-work">
            <Spinner size={22} />
            <span>{work.label}{work.pct != null ? ` ${Math.round(work.pct * 100)}%` : '…'}</span>
          </div>
        )}
      </div>

      <div className="img-tools">
        {original
          ? <button className="btn ghost sm" onClick={() => { set(original); setOriginal(null) }} disabled={!!work}><Undo2 size={15} /> Restaurar fondo</button>
          : <button className="btn ghost sm" onClick={cutout} disabled={!!work}><Eraser size={15} /> Quitar fondo</button>}
        {settings.geminiKey && <button className="btn ghost sm" onClick={autoTag} disabled={!!work}><Wand size={15} /> Autocompletar con IA</button>}
        <button className="btn ghost sm" onClick={() => fileRef.current.click()} disabled={!!work}><ImagePlus size={15} /> Cambiar foto</button>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <Field label="Categoría">
        <Chips options={CATEGORIES.map((c) => ({ id: c.id, name: c.short }))} value={form.category} allowNone={false}
          onChange={(category) => { set({ category, sub: CAT[category].subs.includes(form.sub) ? form.sub : '' }); setError('') }} />
      </Field>

      {subs.length > 0 && (
        <Field label="Tipo">
          <Chips options={subs} value={form.sub || null} onChange={(sub) => set({ sub: sub || '' })} />
        </Field>
      )}

      <Field label="Nombre">
        <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder={form.sub || 'Por ejemplo: Camisa de lino'} maxLength={60} />
      </Field>

      <Field label="Color" hint="detectado de la foto, puedes cambiarlo">
        <div className="chips">
          {COLORS.map((c) => (
            <Chip key={c.id} active={form.colors.includes(c.id)} onClick={() => toggleColor(c.id)}><Swatch id={c.id} /> {c.name}</Chip>
          ))}
        </div>
      </Field>

      <Field label="Clima">
        <Chips multi options={CLIMATES} value={form.climates} onChange={(climates) => set({ climates })} />
      </Field>

      <Field label="Ocasión">
        <Chips multi options={OCCASIONS} value={form.occasions} onChange={(occasions) => set({ occasions })} />
      </Field>

      <div className="field-row">
        <Field label="Marca"><input className="input" value={form.brand} onChange={(e) => set({ brand: e.target.value })} maxLength={40} /></Field>
        <Field label="Talla"><input className="input" value={form.size} onChange={(e) => set({ size: e.target.value })} maxLength={10} /></Field>
        <Field label="Precio"><input className="input" type="number" min="0" inputMode="decimal" value={form.price} onChange={(e) => set({ price: e.target.value })} /></Field>
      </div>

      <Field label="Notas">
        <textarea className="input" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={300} />
      </Field>
    </Sheet>
  )
}
