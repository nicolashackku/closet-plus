import { useEffect, useState } from 'react'
import { Bookmark, BookmarkCheck, CalendarCheck, CloudSun, Pencil, RefreshCw, Shirt, Sparkles, X } from 'lucide-react'
import { useStore } from '../store'
import { Chip, Chips, Collage, Empty, Field, ItemTile, Sheet, Spinner } from '../ui'
import { CATEGORIES, CLIMATES, OCCASIONS, uid, ymd } from '../lib/constants'
import { blobUrl } from '../lib/image'
import { generateOutfits } from '../lib/stylist'
import { aiOutfits, getWeather } from '../lib/ai'

// Se conserva al cambiar de pestaña.
const memory = { occasion: 'casual', climate: null, weather: null, note: '', results: null, notice: '', saved: {}, planned: null }

export default function Stylist() {
  const { items, itemMap, wear, settings, saveSettings, tabParams, open, go, saveOutfit, setPlan, notify } = useStore()
  const [occasion, setOccasion] = useState(memory.occasion)
  const [climate, setClimate] = useState(memory.climate)
  const [weather, setWeather] = useState(memory.weather)
  const [weatherBusy, setWeatherBusy] = useState(false)
  const [note, setNote] = useState(memory.note)
  const [baseId, setBaseId] = useState(tabParams?.baseItemId || null)
  const [results, setResults] = useState(memory.results)
  const [notice, setNotice] = useState(memory.notice)
  const [saved, setSaved] = useState(memory.saved)
  const [planned, setPlanned] = useState(memory.planned)
  const [loading, setLoading] = useState(false)

  const hasKey = !!settings.geminiKey
  const engine = hasKey && settings.engine === 'gemini' ? 'gemini' : 'local'
  const base = baseId ? itemMap.get(baseId) : null
  Object.assign(memory, { occasion, climate, weather, note, results, notice, saved, planned })

  const generate = async (overrideBase) => {
    const opts = { occasion, climate, temp: weather?.temp, baseItemId: overrideBase ?? baseId, count: 6, wear, note: note.trim() }
    setLoading(true)
    setNotice('')
    setSaved({})
    setPlanned(null)
    let out = null
    if (engine === 'gemini') {
      try { out = await aiOutfits(items, settings, opts) } catch (e) { setNotice(`${e.message} Te muestro las propuestas del estilista de Closet+.`) }
    }
    if (!out) {
      const local = generateOutfits(items, opts)
      if (local.error) setNotice(local.error)
      out = local.outfits
      await new Promise((r) => setTimeout(r, 350)) // deja ver que se han renovado
    }
    setResults(out.map((o) => ({ ...o, key: uid() })))
    setLoading(false)
  }

  // Llegada desde "Crear outfit" en una prenda.
  useEffect(() => {
    if (tabParams?.baseItemId && itemMap.has(tabParams.baseItemId)) {
      setBaseId(tabParams.baseItemId)
      generate(tabParams.baseItemId)
    }
  }, [tabParams]) // eslint-disable-line

  const useWeather = async () => {
    setWeatherBusy(true)
    try {
      const w = await getWeather()
      setWeather(w)
      setClimate(w.climate)
    } catch (e) {
      notify(e.message)
    } finally {
      setWeatherBusy(false)
    }
  }

  const asOutfit = (r) => ({
    id: uid(), name: r.name, itemIds: r.itemIds, layout: r.layout, reason: r.reason,
    occasions: occasion ? [occasion] : [], favorite: false, createdAt: Date.now(),
  })
  const keep = async (r) => {
    if (saved[r.key]) return
    const o = asOutfit(r)
    await saveOutfit(o)
    setSaved((s) => ({ ...s, [r.key]: o }))
    notify('Outfit guardado')
  }
  const wearToday = async (r) => {
    await setPlan(ymd(), saved[r.key] || { name: r.name, itemIds: r.itemIds, layout: r.layout })
    setPlanned(r.key)
    notify('Planificado para hoy')
  }

  const canStyle = items.some((i) => i.category === 'onepiece') || (items.some((i) => i.category === 'tops') && items.some((i) => i.category === 'bottoms'))

  return (
    <div className="page">
      <header className="hello">
        <div>
          <p className="eyebrow">Ideas con tu propia ropa</p>
          <h1>Estilista</h1>
        </div>
      </header>

      {!canStyle ? (
        <Empty icon={<Sparkles size={30} strokeWidth={1.4} />} title="Faltan prendas para combinar"
          text="Añade al menos una parte de arriba y una de abajo (o un vestido) y el estilista te propondrá outfits.">
          <button className="btn" onClick={() => go('closet')}>Ir al armario</button>
        </Empty>
      ) : (
        <>
          <section className="panel">
            <Field label="Ocasión">
              <Chips options={OCCASIONS} value={occasion} onChange={setOccasion} />
            </Field>
            <Field label="Clima" hint={weather ? `${Math.round(weather.temp)} °C${weather.text ? ` · ${weather.text}` : ''} ahora` : undefined}>
              <div className="chips">
                {CLIMATES.map((c) => <Chip key={c.id} active={climate === c.id} onClick={() => setClimate(climate === c.id ? null : c.id)}>{c.name}</Chip>)}
                <button className="chip outline" onClick={useWeather} disabled={weatherBusy}>
                  {weatherBusy ? <Spinner size={13} /> : <CloudSun size={15} />} Clima de hoy
                </button>
              </div>
            </Field>
            <Field label="Prenda protagonista" hint="opcional">
              {base ? (
                <div className="base-item">
                  <img src={blobUrl(base.image)} alt="" />
                  <span>{base.name}</span>
                  <button className="icon-btn" onClick={() => setBaseId(null)} aria-label="Quitar prenda protagonista"><X size={16} /></button>
                </div>
              ) : (
                <button className="chip outline" onClick={() => open('itemPick', { onPick: (item) => setBaseId(item.id) })}><Shirt size={15} /> Elegir una prenda</button>
              )}
            </Field>
            <Field label="Quién combina">
              <div className="segmented" role="tablist">
                <button role="tab" aria-selected={engine === 'local'} className={engine === 'local' ? 'on' : ''} onClick={() => saveSettings({ engine: 'local' })}>Estilista Closet+</button>
                <button role="tab" aria-selected={engine === 'gemini'} className={engine === 'gemini' ? 'on' : ''}
                  onClick={() => (hasKey ? saveSettings({ engine: 'gemini' }) : (notify('Activa Gemini gratis desde tu perfil'), go('profile', { focus: 'ai' })))}>
                  <Sparkles size={14} /> Gemini IA
                </button>
              </div>
              {engine === 'gemini' && (
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140}
                  placeholder="¿Algo en mente? Ej.: cena elegante pero cómoda" aria-label="Petición para la IA" />
              )}
            </Field>
            <button className="btn block" onClick={() => generate()} disabled={loading}>
              {loading ? <><Spinner /> Combinando…</> : results ? <><RefreshCw size={17} /> Otra tanda</> : <><Sparkles size={17} /> Crear outfits</>}
            </button>
          </section>

          {notice && <p className="hint center" role="status">{notice}</p>}

          {results && results.length > 0 && (
            <div className={`grid outfits results ${loading ? 'dim' : ''}`}>
              {results.map((r) => (
                <article key={r.key} className="result">
                  <button className="result-collage" onClick={() => open('outfitEdit', { outfit: saved[r.key] || { name: r.name, itemIds: r.itemIds, layout: r.layout, reason: r.reason, occasions: occasion ? [occasion] : [] } })}
                    aria-label={`Editar ${r.name}`}>
                    <Collage layout={r.layout}>
                      <span className="pill">{r.ai ? <><Sparkles size={11} /> Gemini</> : `${r.affinity}% afín`}</span>
                    </Collage>
                  </button>
                  <h3>{r.name}</h3>
                  <p>{r.reason}</p>
                  <div className="result-actions">
                    <button className={`btn sm ${saved[r.key] ? 'ghost' : ''}`} onClick={() => keep(r)} disabled={!!saved[r.key]}>
                      {saved[r.key] ? <><BookmarkCheck size={15} /> Guardado</> : <><Bookmark size={15} /> Guardar</>}
                    </button>
                    <button className={`icon-btn boxed ${planned === r.key ? 'on' : ''}`} onClick={() => wearToday(r)} disabled={planned === r.key}
                      aria-label={`Usar ${r.name} hoy`} title={planned === r.key ? 'Planificado para hoy' : 'Usar hoy'}>
                      <CalendarCheck size={15} />
                    </button>
                    {!saved[r.key] && (
                      <button className="icon-btn boxed" aria-label={`Ajustar ${r.name}`} title="Ajustar en el editor"
                        onClick={() => open('outfitEdit', { outfit: { name: r.name, itemIds: r.itemIds, layout: r.layout, reason: r.reason, occasions: occasion ? [occasion] : [] } })}>
                        <Pencil size={15} />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ---------- Selector de una prenda ---------- */
export function ItemPicker({ onPick, title = 'Elegir prenda' }) {
  const { items, close } = useStore()
  const [cat, setCat] = useState('all')
  const cats = CATEGORIES.filter((c) => items.some((i) => i.category === c.id))
  return (
    <Sheet title={title}>
      <div className="chips scroll">
        <Chip active={cat === 'all'} onClick={() => setCat('all')}>Todo</Chip>
        {cats.map((c) => <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.short}</Chip>)}
      </div>
      <div className="grid compact">
        {items.filter((i) => cat === 'all' || i.category === cat).map((item) => (
          <ItemTile key={item.id} item={item} onClick={() => { onPick(item); close() }} />
        ))}
      </div>
    </Sheet>
  )
}
