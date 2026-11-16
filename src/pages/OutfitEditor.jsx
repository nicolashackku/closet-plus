import { useMemo, useRef, useState } from 'react'
import { LayoutTemplate, X } from 'lucide-react'
import { useStore } from '../store'
import { Chip, Chips, Field, ItemTile, Pic, Sheet } from '../ui'
import { CATEGORIES, OCCASIONS, uid } from '../lib/constants'
import { autoLayout } from '../lib/stylist'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export function OutfitEditor({ outfit }) {
  const { items, itemMap, outfits, saveOutfit, close, notify } = useStore()
  const [name, setName] = useState(outfit?.name || '')
  const [occasions, setOccasions] = useState(outfit?.occasions || [])
  // El orden del array es el orden de capas: el último queda encima.
  const [layout, setLayout] = useState(() => (outfit?.layout || []).filter((l) => itemMap.has(l.itemId)))
  const [sel, setSel] = useState(null)
  const [cat, setCat] = useState('all')
  const canvasRef = useRef()

  const inCanvas = useMemo(() => new Set(layout.map((l) => l.itemId)), [layout])
  const cats = CATEGORIES.filter((c) => items.some((i) => i.category === c.id))
  const tray = items.filter((i) => cat === 'all' || i.category === cat)

  const toggle = (item) => {
    if (inCanvas.has(item.id)) {
      setLayout((l) => l.filter((x) => x.itemId !== item.id))
      if (sel === item.id) setSel(null)
      return
    }
    const current = layout.map((l) => itemMap.get(l.itemId)).filter(Boolean)
    const slot = autoLayout([...current, item]).find((l) => l.itemId === item.id)
    setLayout((l) => [...l, slot])
    setSel(item.id)
  }

  const tidy = () => {
    setLayout(autoLayout(layout.map((l) => itemMap.get(l.itemId)).filter(Boolean)))
    setSel(null)
  }

  const startDrag = (e, id, mode) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = canvasRef.current.getBoundingClientRect()
    const start = layout.find((l) => l.itemId === id)
    const sx = e.clientX, sy = e.clientY
    setSel(id)
    setLayout((l) => [...l.filter((x) => x.itemId !== id), l.find((x) => x.itemId === id)])

    const move = (ev) => {
      let patch
      if (mode === 'move') {
        patch = { x: clamp(start.x + (ev.clientX - sx) / rect.width, 0.02, 0.98), y: clamp(start.y + (ev.clientY - sy) / rect.height, 0.02, 0.98) }
      } else {
        const cx = rect.left + start.x * rect.width, cy = rect.top + start.y * rect.height
        const dist = Math.max(Math.abs(ev.clientX - cx), Math.abs(ev.clientY - cy))
        patch = { s: clamp((dist * 2) / rect.width, 0.12, 1.1) }
      }
      setLayout((l) => l.map((x) => (x.itemId === id ? { ...x, ...patch } : x)))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const save = async () => {
    const isNew = !outfit?.id
    await saveOutfit({
      id: outfit?.id || uid(),
      name: name.trim() || `Outfit ${outfits.length + 1}`,
      itemIds: layout.map((l) => l.itemId), layout, occasions,
      reason: outfit?.reason || '', favorite: outfit?.favorite || false,
      createdAt: outfit?.createdAt || Date.now(),
    })
    notify(isNew ? 'Outfit guardado' : 'Cambios guardados')
    close()
  }

  // Orden de pintado estable (por id) y capas con z-index: así arrastrar no recoloca nodos.
  const stable = [...layout].sort((a, b) => a.itemId.localeCompare(b.itemId))

  return (
    <Sheet full className="editor" title={outfit?.id ? 'Editar outfit' : 'Nuevo outfit'}
      footer={<button className="btn block" onClick={save} disabled={layout.length < 2}>
        {layout.length < 2 ? 'Elige al menos 2 prendas' : 'Guardar outfit'}
      </button>}>
      <div className="ed-stage">
        <div className="collage ed-canvas" ref={canvasRef} onPointerDown={() => setSel(null)}>
          {layout.length === 0 && <p className="ed-hint">Toca prendas para añadirlas.<br />Luego arrástralas y cámbiales el tamaño.</p>}
          {stable.map((l) => {
            const item = itemMap.get(l.itemId)
            if (!item) return null
            const active = sel === l.itemId
            return (
              <div key={l.itemId} className={`ed-item ${active ? 'active' : ''}`}
                style={{ left: `${l.x * 100}%`, top: `${l.y * 100}%`, width: `${l.s * 100}%`, zIndex: layout.indexOf(l) + 1 }}
                onPointerDown={(e) => startDrag(e, l.itemId, 'move')}>
                <Pic item={item} />
                {active && <>
                  <button className="ed-remove" aria-label={`Quitar ${item.name}`}
                    onPointerDown={(e) => { e.stopPropagation(); toggle(item) }}><X size={13} /></button>
                  <span className="ed-handle" onPointerDown={(e) => startDrag(e, l.itemId, 'resize')} />
                </>}
              </div>
            )
          })}
        </div>
        {layout.length > 1 && (
          <button className="icon-btn boxed ed-tidy" onClick={tidy} aria-label="Ordenar prendas automáticamente" title="Ordenar automáticamente">
            <LayoutTemplate size={17} />
          </button>
        )}
      </div>

      <div className="ed-tray">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del outfit" maxLength={50} aria-label="Nombre del outfit" />
        <div className="chips scroll">
          <Chip active={cat === 'all'} onClick={() => setCat('all')}>Todo</Chip>
          {cats.map((c) => <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.short}</Chip>)}
        </div>
        <div className="grid tray">
          {tray.map((item) => <ItemTile key={item.id} small item={item} selected={inCanvas.has(item.id)} onClick={() => toggle(item)} />)}
        </div>
        <Field label="Ocasión" hint="opcional">
          <Chips multi options={OCCASIONS} value={occasions} onChange={setOccasions} />
        </Field>
      </div>
    </Sheet>
  )
}
