import { useEffect } from 'react'
import { X, Heart, User } from 'lucide-react'
import { useStore } from './store'
import { blobUrl } from './lib/image'
import { COLOR } from './lib/constants'

// Pila de capas abiertas: Escape solo cierra la de arriba.
const layers = []
function useLayer(doClose) {
  useEffect(() => {
    const token = {}
    layers.push(token)
    const onKey = (e) => { if (e.key === 'Escape' && layers[layers.length - 1] === token) doClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      layers.splice(layers.indexOf(token), 1)
      if (!layers.length) document.body.style.overflow = ''
    }
  }, []) // eslint-disable-line
}

export function Sheet({ title, onClose, children, footer, full, action, className = '' }) {
  const { close } = useStore()
  const doClose = onClose || (() => close())
  useLayer(doClose)
  return (
    <div className="backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) doClose() }}>
      <div className={`sheet ${full ? 'full' : ''} ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="sheet-head">
          <button className="icon-btn" onClick={doClose} aria-label="Cerrar"><X size={20} /></button>
          <h2>{title}</h2>
          <div className="sheet-action">{action}</div>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function Confirm({ title, text, action = 'Eliminar', danger = true, onConfirm }) {
  const { close } = useStore()
  useLayer(() => close())
  return (
    <div className="backdrop center" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="dialog" role="alertdialog" aria-label={title}>
        <h3>{title}</h3>
        {text && <p>{text}</p>}
        <div className="dialog-actions">
          <button className="btn ghost" onClick={() => close()}>Cancelar</button>
          <button className={`btn ${danger ? 'danger' : ''}`} onClick={onConfirm}>{action}</button>
        </div>
      </div>
    </div>
  )
}

export function Chip({ active, onClick, children, ...rest }) {
  return <button type="button" className={`chip ${active ? 'on' : ''}`} onClick={onClick} aria-pressed={!!active} {...rest}>{children}</button>
}

/** Grupo de chips. multi: value es un array; si no, un id o null. */
export function Chips({ options, value, onChange, multi, allowNone = true, scroll }) {
  const isOn = (id) => (multi ? value.includes(id) : value === id)
  const toggle = (id) => {
    if (multi) onChange(isOn(id) ? value.filter((v) => v !== id) : [...value, id])
    else onChange(isOn(id) && allowNone ? null : id)
  }
  return (
    <div className={`chips ${scroll ? 'scroll' : ''}`}>
      {options.map((o) => {
        const opt = typeof o === 'string' ? { id: o, name: o } : o
        return <Chip key={opt.id} active={isOn(opt.id)} onClick={() => toggle(opt.id)}>{opt.name}</Chip>
      })}
    </div>
  )
}

export function Swatch({ id, size = 14 }) {
  const c = COLOR[id]
  if (!c) return null
  return <span className="swatch" title={c.name} style={{ background: c.hex, width: size, height: size }} />
}

/** Foto de una prenda. Las fotos con fondo se funden con la casilla gris; los recortes no. */
export function Pic({ item, style }) {
  if (!item?.image) return null
  return <img className={item.cutout ? 'pic' : 'pic blend'} src={blobUrl(item.image)} alt={item.name || ''} draggable={false} style={style} />
}

export function ItemTile({ item, onClick, selected, meta, small }) {
  return (
    <button type="button" className={`tile ${selected ? 'selected' : ''} ${small ? 'small' : ''}`} onClick={onClick}>
      <div className="tile-img">
        <Pic item={item} />
        {item.favorite && <Heart className="tile-fav" size={14} fill="currentColor" />}
        {item.needsReview && <span className="tile-dot" title="Por completar" />}
        {selected && <span className="tile-check">✓</span>}
      </div>
      {!small && (
        <div className="tile-text">
          <span className="tile-name">{item.name}</span>
          <span className="tile-meta">{meta ?? ([item.sub, item.brand].filter(Boolean).join(' · ') || ' ')}</span>
        </div>
      )}
    </button>
  )
}

/** Collage de un outfit: cada prenda en una casilla cuadrada colocada sobre un lienzo 3:4. */
export function Collage({ layout = [], className = '', children }) {
  const { itemMap } = useStore()
  return (
    <div className={`collage ${className}`}>
      {layout.map((l) => {
        const item = itemMap.get(l.itemId)
        if (!item?.image) return null
        return <Pic key={l.itemId} item={item} style={{ left: `${l.x * 100}%`, top: `${l.y * 100}%`, width: `${l.s * 100}%` }} />
      })}
      {children}
    </div>
  )
}

export function Avatar({ size = 40 }) {
  const { profile } = useStore()
  return (
    <span className="avatar" style={{ width: size, height: size }}>
      {profile.avatar ? <img src={blobUrl(profile.avatar)} alt="Foto de perfil" /> : <User size={size * 0.48} strokeWidth={1.6} />}
    </span>
  )
}

export function Empty({ icon, title, text, children }) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children && <div className="empty-actions">{children}</div>}
    </div>
  )
}

export function Field({ label, hint, children }) {
  return (
    <div className="field">
      <div className="field-label">{label}{hint && <span>{hint}</span>}</div>
      {children}
    </div>
  )
}

export function Spinner({ size = 16 }) {
  return <span className="spinner" style={{ width: size, height: size }} />
}
