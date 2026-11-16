import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import * as db from './lib/db'
import { ymd } from './lib/constants'
import { blobToDataUrl, dataUrlToBlob } from './lib/image'
import { buildSamples } from './lib/samples'
import { BUILT_IN_KEY } from './lib/ai'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

const DEFAULT_PROFILE = { name: '', bio: '', avatar: null }
const DEFAULT_SETTINGS = { geminiKey: '', geminiModel: '', engine: BUILT_IN_KEY ? 'gemini' : 'local' }
const byNewest = (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
const upsert = (list, value, key = 'id') => [value, ...list.filter((x) => x[key] !== value[key])]

export function StoreProvider({ children }) {
  const [ready, setReady] = useState(false)
  const [items, setItems] = useState([])
  const [outfits, setOutfits] = useState([])
  const [plans, setPlans] = useState([])
  const [profile, setProfile] = useState(DEFAULT_PROFILE)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  const [tab, setTabState] = useState(() => sessionStorage.getItem('tab') || 'closet')
  const [tabParams, setTabParams] = useState(null)
  const [overlays, setOverlays] = useState([])
  const [toast, setToast] = useState(null)
  const toastTimer = useRef()

  /* ---------- Carga inicial ---------- */
  const reload = useCallback(async () => {
    const [i, o, p, prof, sett] = await Promise.all([
      db.getAll('items'), db.getAll('outfits'), db.getAll('plans'),
      db.getKv('profile', DEFAULT_PROFILE), db.getKv('settings', DEFAULT_SETTINGS),
    ])
    setItems(i.sort(byNewest)); setOutfits(o.sort(byNewest)); setPlans(p)
    setProfile({ ...DEFAULT_PROFILE, ...prof }); setSettings({ ...DEFAULT_SETTINGS, ...sett })
  }, [])

  useEffect(() => {
    reload().catch((e) => console.error(e)).finally(() => setReady(true))
    db.requestPersistence()
  }, [reload])

  /* ---------- Navegación: pestañas y hojas (el botón atrás cierra la hoja) ---------- */
  useEffect(() => {
    history.replaceState({ ov: 0 }, '')
    const onPop = () => setOverlays((o) => o.slice(0, history.state?.ov || 0))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const go = useCallback((next, params = null) => {
    sessionStorage.setItem('tab', next)
    setTabParams(params)
    setTabState(next)
    window.scrollTo(0, 0)
  }, [])
  const open = useCallback((type, props = {}) => {
    const entry = { type, props, key: Date.now() + Math.random() }
    history.pushState({ ov: (history.state?.ov || 0) + 1 }, '')
    setOverlays((o) => [...o, entry])
  }, [])
  const close = useCallback((n = 1) => history.go(-n), [])

  const notify = useCallback((msg) => {
    clearTimeout(toastTimer.current)
    setToast({ msg, id: Date.now() })
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }, [])

  /* ---------- Prendas ---------- */
  const saveItem = useCallback(async (item) => {
    await db.put('items', item)
    setItems((l) => upsert(l, item).sort(byNewest))
  }, [])
  const saveItems = useCallback(async (list) => {
    await db.putMany('items', list)
    setItems((l) => [...list, ...l.filter((x) => !list.some((n) => n.id === x.id))].sort(byNewest))
  }, [])
  const deleteItem = useCallback(async (id) => {
    await db.del('items', id)
    setItems((l) => l.filter((x) => x.id !== id))
    // Los outfits que la usaban la pierden; si se quedan vacíos, se eliminan.
    const affected = outfits.filter((o) => o.itemIds.includes(id))
    for (const o of affected) {
      const itemIds = o.itemIds.filter((x) => x !== id)
      if (itemIds.length < 2) await db.del('outfits', o.id)
      else await db.put('outfits', { ...o, itemIds, layout: o.layout.filter((l) => l.itemId !== id) })
    }
    if (affected.length) setOutfits((await db.getAll('outfits')).sort(byNewest))
  }, [outfits])

  const toggleWornToday = useCallback(async (item) => {
    const today = ymd()
    const dates = item.wornDates || []
    const next = { ...item, wornDates: dates.includes(today) ? dates.filter((d) => d !== today) : [...dates, today] }
    await saveItem(next)
    return next.wornDates.includes(today)
  }, [saveItem])

  /* ---------- Outfits y calendario ---------- */
  const saveOutfit = useCallback(async (outfit) => {
    await db.put('outfits', outfit)
    setOutfits((l) => upsert(l, outfit).sort(byNewest))
  }, [])
  const deleteOutfit = useCallback(async (id) => {
    await db.del('outfits', id)
    setOutfits((l) => l.filter((x) => x.id !== id))
  }, [])
  const setPlan = useCallback(async (date, outfit) => {
    if (!outfit) {
      await db.del('plans', date)
      setPlans((l) => l.filter((p) => p.date !== date))
      return
    }
    const plan = { date, outfitId: outfit.id || null, name: outfit.name || '', itemIds: outfit.itemIds, layout: outfit.layout }
    await db.put('plans', plan)
    setPlans((l) => upsert(l, plan, 'date'))
  }, [])

  /* ---------- Perfil y ajustes ---------- */
  const saveProfile = useCallback(async (patch) => {
    const next = { ...profile, ...patch }
    setProfile(next)
    await db.setKv('profile', next)
  }, [profile])
  const saveSettings = useCallback(async (patch) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    await db.setKv('settings', next)
  }, [settings])

  /* ---------- Copia de seguridad ---------- */
  const exportBackup = useCallback(async () => {
    const data = {
      app: 'closet-plus', version: 1, exportedAt: new Date().toISOString(),
      items: await Promise.all(items.map(async (i) => ({ ...i, image: i.image ? await blobToDataUrl(i.image) : null }))),
      outfits, plans,
      profile: { ...profile, avatar: profile.avatar ? await blobToDataUrl(profile.avatar) : null },
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `closet-plus-${ymd()}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }, [items, outfits, plans, profile])

  const importBackup = useCallback(async (file) => {
    const data = JSON.parse(await file.text())
    if (data.app !== 'closet-plus' || !Array.isArray(data.items)) throw new Error('El archivo no es una copia de Closet+.')
    const restored = await Promise.all(data.items.map(async (i) => ({ ...i, image: i.image ? await dataUrlToBlob(i.image) : null })))
    const avatar = data.profile?.avatar ? await dataUrlToBlob(data.profile.avatar) : null
    await Promise.all(['items', 'outfits', 'plans'].map((s) => db.clear(s)))
    await db.putMany('items', restored)
    await db.putMany('outfits', data.outfits || [])
    await db.putMany('plans', data.plans || [])
    await db.setKv('profile', { ...DEFAULT_PROFILE, ...data.profile, avatar })
    await reload()
    return restored.length
  }, [reload])

  const clearAll = useCallback(async () => {
    await Promise.all(['items', 'outfits', 'plans'].map((s) => db.clear(s)))
    await reload()
  }, [reload])

  const loadSamples = useCallback(async () => {
    const samples = await buildSamples()
    await saveItems(samples)
    return samples.length
  }, [saveItems])

  /* ---------- Usos por prenda (calendario + "lo usé hoy") ---------- */
  const wear = useMemo(() => {
    const today = ymd()
    const days = {}
    const add = (id, date) => { (days[id] ||= new Set()).add(date) }
    for (const p of plans) if (p.date <= today) p.itemIds.forEach((id) => add(id, p.date))
    for (const i of items) (i.wornDates || []).forEach((d) => add(i.id, d))
    const out = {}
    for (const [id, set] of Object.entries(days)) out[id] = { count: set.size, last: [...set].sort().pop() }
    return out
  }, [plans, items])

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const effectiveSettings = useMemo(
    () => ({ ...settings, geminiKey: settings.geminiKey || BUILT_IN_KEY, ownKey: settings.geminiKey, builtInKey: !!BUILT_IN_KEY }),
    [settings],
  )

  const value = {
    ready, items, itemMap, outfits, plans, profile, settings: effectiveSettings, wear,
    tab, tabParams, go, overlays, open, close, toast, notify,
    saveItem, saveItems, deleteItem, toggleWornToday, saveOutfit, deleteOutfit, setPlan,
    saveProfile, saveSettings, exportBackup, importBackup, clearAll, loadSamples,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
