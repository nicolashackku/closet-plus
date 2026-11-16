import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Check, Download, ExternalLink, Shirt, Trash2, Upload } from 'lucide-react'
import { useStore } from '../store'
import { Avatar, Field, ItemTile, Spinner } from '../ui'
import { CATEGORIES, COLORS, money } from '../lib/constants'
import { makeAvatar } from '../lib/image'
import { DEFAULT_MODEL, testGemini } from '../lib/ai'

export default function Profile() {
  const store = useStore()
  const { items, outfits, wear, profile, settings, tabParams, open, close, notify } = store
  const [name, setName] = useState(profile.name)
  const [bio, setBio] = useState(profile.bio)
  const [key, setKey] = useState(settings.ownKey)
  const [model, setModel] = useState(settings.geminiModel)
  const [test, setTest] = useState(null) // 'busy' | 'ok' | mensaje de error
  const [busy, setBusy] = useState('')
  const avatarRef = useRef()
  const importRef = useRef()
  const aiRef = useRef()

  useEffect(() => { setName(profile.name); setBio(profile.bio) }, [profile.name, profile.bio])
  useEffect(() => { if (tabParams?.focus === 'ai') aiRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [tabParams])

  const onAvatar = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      await store.saveProfile({ avatar: await makeAvatar(file) })
      notify('Foto de perfil actualizada')
    } catch { notify('No se pudo leer la foto') }
  }

  const stats = useMemo(() => {
    const value = items.reduce((s, i) => s + (Number(i.price) || 0), 0)
    const uses = Object.entries(wear).filter(([id]) => items.some((i) => i.id === id)).reduce((s, [, w]) => s + w.count, 0)
    const colorCount = {}
    items.forEach((i) => { const c = i.colors?.[0]; if (c) colorCount[c] = (colorCount[c] || 0) + 1 })
    const colors = COLORS.filter((c) => colorCount[c.id]).map((c) => ({ ...c, n: colorCount[c.id] })).sort((a, b) => b.n - a.n)
    const cats = CATEGORIES.map((c) => ({ ...c, n: items.filter((i) => i.category === c.id).length })).filter((c) => c.n)
    const most = items.filter((i) => wear[i.id]?.count).sort((a, b) => wear[b.id].count - wear[a.id].count).slice(0, 8)
    const unworn = items.filter((i) => !wear[i.id]?.count)
    return { value, uses, colors, cats, most, unworn }
  }, [items, wear])

  const saveAi = async () => {
    const active = !!key.trim() || settings.builtInKey
    await store.saveSettings({ geminiKey: key.trim(), geminiModel: model.trim(), engine: active ? 'gemini' : 'local' })
    if (!active) { setTest(null); notify('Gemini desactivado'); return }
    setTest('busy')
    try {
      await testGemini({ geminiKey: key, geminiModel: model })
      setTest('ok')
    } catch (e) { setTest(e.message) }
  }

  const onImport = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    open('confirm', {
      title: '¿Restaurar esta copia?', action: 'Restaurar',
      text: 'Se reemplazará todo lo que hay ahora en la app (prendas, outfits, calendario y perfil).',
      onConfirm: async () => {
        close()
        setBusy('import')
        try { notify(`Copia restaurada: ${await store.importBackup(file)} prendas`) }
        catch (err) { notify(err.message || 'No se pudo leer la copia') }
        finally { setBusy('') }
      },
    })
  }

  const wipe = () => open('confirm', {
    title: '¿Borrar todo el armario?', action: 'Borrar todo',
    text: 'Se eliminarán todas las prendas, outfits y el calendario de este navegador. No se puede deshacer.',
    onConfirm: async () => { close(); await store.clearAll(); notify('Armario vaciado') },
  })

  const samples = async () => {
    setBusy('samples')
    try { notify(`${await store.loadSamples()} prendas de ejemplo añadidas`) } finally { setBusy('') }
  }

  const maxCat = Math.max(1, ...stats.cats.map((c) => c.n))

  return (
    <div className="page narrow">
      <input ref={avatarRef} type="file" accept="image/*" hidden onChange={onAvatar} />
      <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={onImport} />

      <section className="profile-head">
        <button className="avatar-edit" onClick={() => avatarRef.current.click()} aria-label="Cambiar foto de perfil">
          <Avatar size={104} />
          <span className="avatar-cam"><Camera size={15} /></span>
        </button>
        <input className="name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" maxLength={30} aria-label="Nombre"
          onBlur={() => name.trim() !== profile.name && store.saveProfile({ name: name.trim() })} onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} />
        <input className="bio-input" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Describe tu estilo en una frase" maxLength={80} aria-label="Tu estilo"
          onBlur={() => bio.trim() !== profile.bio && store.saveProfile({ bio: bio.trim() })} onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} />
      </section>

      <div className="stats four">
        <div><b>{items.length}</b><span>prendas</span></div>
        <div><b>{outfits.length}</b><span>outfits</span></div>
        <div><b>{stats.uses}</b><span>usos</span></div>
        <div><b>{money(stats.value)}</b><span>valor</span></div>
      </div>

      {items.length > 0 && (
        <>
          <section className="card">
            <h2>Tus colores</h2>
            <div className="color-bar" role="img" aria-label={stats.colors.map((c) => `${c.name}: ${c.n}`).join(', ')}>
              {stats.colors.map((c) => <span key={c.id} style={{ flex: c.n, background: c.hex }} title={`${c.name}: ${c.n}`} />)}
            </div>
            <div className="legend">
              {stats.colors.slice(0, 6).map((c) => (
                <span key={c.id}><i style={{ background: c.hex }} /> {c.name} <b>{Math.round((c.n / items.length) * 100)}%</b></span>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>Por categoría</h2>
            <div className="bars">
              {stats.cats.map((c) => (
                <div key={c.id} className="bar-row">
                  <span>{c.name}</span>
                  <div className="bar"><i style={{ width: `${(c.n / maxCat) * 100}%` }} /></div>
                  <b>{c.n}</b>
                </div>
              ))}
            </div>
          </section>

          {stats.most.length > 0 && (
            <section className="card">
              <h2>Lo que más usas</h2>
              <div className="hscroll">
                {stats.most.map((item) => (
                  <div key={item.id} className="hitem">
                    <ItemTile small item={item} onClick={() => open('item', { id: item.id })} />
                    <span>{wear[item.id].count} {wear[item.id].count === 1 ? 'uso' : 'usos'}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {stats.unworn.length > 0 && (
            <section className="card">
              <h2>Sin estrenar <small>{stats.unworn.length}</small></h2>
              <p className="hint">Prendas sin ningún uso registrado. Dales una oportunidad.</p>
              <div className="hscroll">
                {stats.unworn.slice(0, 12).map((item) => (
                  <div key={item.id} className="hitem"><ItemTile small item={item} onClick={() => open('item', { id: item.id })} /></div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <section className="card" ref={aiRef}>
        <h2>Inteligencia artificial</h2>
        <p className="hint">
          El estilista de Closet+ funciona siempre, sin configurar nada. Si quieres que además combine Gemini (la IA de Google) y
          que rellene los datos de tus prendas a partir de la foto, pega aquí una clave gratuita.
        </p>
        {settings.builtInKey && <p className="ok">Gemini ya está activado: la clave viene incluida en la app.</p>}
        <a className="link ext" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Conseguir clave gratis en Google AI Studio <ExternalLink size={13} /></a>
        <Field label="Clave de Gemini">
          <input className="input" type="password" autoComplete="off" value={key} onChange={(e) => { setKey(e.target.value); setTest(null) }} placeholder={settings.builtInKey ? 'Ya incluida en la app' : 'Pega aquí tu clave'} />
        </Field>
        <Field label="Modelo" hint="opcional">
          <input className="input" value={model} onChange={(e) => { setModel(e.target.value); setTest(null) }} placeholder={DEFAULT_MODEL} />
        </Field>
        <div className="row-actions start">
          <button className="btn sm" onClick={saveAi} disabled={test === 'busy' || (key === settings.ownKey && model === settings.geminiModel && test === 'ok')}>
            {test === 'busy' ? <><Spinner /> Probando…</> : 'Guardar y probar'}
          </button>
          {test === 'ok' && <span className="ok"><Check size={15} /> Conectado</span>}
        </div>
        {test && test !== 'ok' && test !== 'busy' && <p className="error" role="alert">{test}</p>}
        <p className="hint small">La clave se guarda solo en este navegador. Al usar Gemini se envían a Google los datos de tus prendas (y la foto al autocompletar).</p>
      </section>

      <section className="card">
        <h2>Tus datos</h2>
        <p className="hint">Todo se guarda en este navegador, sin cuentas ni servidores. Haz una copia de vez en cuando o para pasar tu armario a otro dispositivo.</p>
        <div className="list">
          <button onClick={() => store.exportBackup()} disabled={!items.length}><Download size={17} /> Descargar copia de seguridad</button>
          <button onClick={() => importRef.current.click()} disabled={busy === 'import'}>{busy === 'import' ? <Spinner /> : <Upload size={17} />} Restaurar una copia</button>
          <button onClick={samples} disabled={busy === 'samples'}>{busy === 'samples' ? <Spinner /> : <Shirt size={17} />} Añadir prendas de ejemplo</button>
          <button className="danger" onClick={wipe} disabled={!items.length}><Trash2 size={17} /> Borrar todo el armario</button>
        </div>
      </section>
    </div>
  )
}
