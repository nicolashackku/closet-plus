// Estilista local: combina prendas con reglas de armonía de color, clima, ocasión y rotación.
// Funciona sin internet y sin claves. Gemini (opcional) usa las mismas estructuras.
import { COLOR, OCCASION } from './constants'

const colorOf = (item) => COLOR[item.colors?.[0]] || COLOR.gris
const hueDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d }

// Parejas con nota propia (ids en orden alfabético): clásicos que funcionan y mezclas delicadas.
const PAIRS = {
  'blanco+negro': 0.97, 'blanco+denim': 0.97, 'blanco+marino': 0.96, 'beige+blanco': 0.94, 'beige+marron': 0.96,
  'beige+denim': 0.93, 'denim+marron': 0.93, 'beige+marino': 0.93, 'gris+negro': 0.92, 'blanco+gris': 0.9,
  'beige+negro': 0.88, 'denim+negro': 0.9, 'beige+oliva': 0.93, 'blanco+oliva': 0.92, 'burdeos+negro': 0.92,
  'beige+gris': 0.74, 'gris+marron': 0.68, 'marron+negro': 0.62, 'marino+negro': 0.55, 'denim+marino': 0.7,
  'burdeos+marino': 0.85, 'celeste+marino': 0.9, 'celeste+denim': 0.82, 'marron+oliva': 0.88, 'marron+verde': 0.8,
}

/** Armonía entre dos colores, de 0 (chocan) a 1 (perfectos). */
export function harmony(a, b) {
  if (a.kind === 'multi' && b.kind === 'multi') return 0.2
  if (a.kind === 'multi' || b.kind === 'multi') return (a.kind === 'neutral' || b.kind === 'neutral') ? 0.85 : 0.45
  if (a.id === b.id) return a.kind === 'neutral' ? 0.88 : 0.8
  const pair = [a.id, b.id].sort().join('+')
  if (PAIRS[pair] != null) return PAIRS[pair]
  if (a.kind === 'neutral' && b.kind === 'neutral') return 0.86
  if (a.kind === 'neutral' || b.kind === 'neutral') return 0.9
  if (a.kind === 'earth' && b.kind === 'earth') return 0.8
  if (a.kind === 'pastel' && b.kind === 'pastel') return 0.72
  const d = hueDiff(a.hue, b.hue)
  if (d < 40) return 0.76
  if (d > 150) return 0.66
  if (d > 100) return 0.5
  return 0.34
}

function tagFit(tags, wanted) {
  if (!wanted) return 0.6
  if (!tags || tags.length === 0) return 0.5
  return tags.includes(wanted) ? 1 : 0.08
}

function pick(list, weightFn) {
  if (!list.length) return null
  const weights = list.map(weightFn)
  let r = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < list.length; i++) { r -= weights[i]; if (r <= 0) return list[i] }
  return list[list.length - 1]
}

function describe(items, { occasion, climate }) {
  const cols = items.map(colorOf)
  const accents = [...new Map(cols.filter((c) => c.kind !== 'neutral').map((c) => [c.id, c])).values()]
  const allSame = new Set(cols.map((c) => c.id)).size === 1
  const low = (c) => c.name.toLowerCase()
  let palette, text
  if (allSame) {
    palette = 'monocromo'
    text = `Look monocromático en ${low(cols[0])}: limpio y estilizado.`
  } else if (accents.length === 0) {
    const names = [...new Set(cols.map(low))].slice(0, 3).join(', ')
    palette = 'en neutros'
    text = `Base de neutros (${names}) que combina sin esfuerzo.`
  } else if (accents.length === 1) {
    palette = accents[0].kind === 'multi' ? 'con estampado' : `con toque ${low(accents[0])}`
    text = accents[0].kind === 'multi'
      ? 'El estampado es el protagonista y los neutros lo dejan respirar.'
      : `Neutros con ${low(accents[0])} como protagonista.`
  } else {
    const [a, b] = accents
    const d = a.hue != null && b.hue != null ? hueDiff(a.hue, b.hue) : 0
    palette = d > 150 ? 'en contraste' : 'tono sobre tono'
    text = d > 150
      ? `Contraste de ${low(a)} y ${low(b)} equilibrado con el resto.`
      : `${a.name} y ${low(b)} son tonos que armonizan entre sí.`
  }
  const extra = []
  if (climate === 'frio' && items.some((i) => i.category === 'outerwear')) extra.push('Con capa de abrigo para el frío.')
  if (climate === 'calor') extra.push('Ligero para un día de calor.')
  const occ = occasion ? OCCASION[occasion].name : 'Look'
  return { name: `${occ} ${palette}`, reason: [text, ...extra].join(' ') }
}

/**
 * Genera outfits. Devuelve { outfits: [{ itemIds, name, reason, affinity }], error? }.
 * opts: { occasion, climate, baseItemId, count, wear: { [itemId]: { count } } }
 */
export function generateOutfits(items, opts = {}) {
  const { occasion, climate, baseItemId, count = 6, wear = {} } = opts
  const by = (cat) => items.filter((i) => i.category === cat)
  const tops = by('tops'), bottoms = by('bottoms'), ones = by('onepiece')
  const outer = by('outerwear'), shoes = by('shoes'), bags = by('bags'), accs = by('accessories')
  const canSeparates = tops.length > 0 && bottoms.length > 0
  if (!canSeparates && ones.length === 0) {
    return { outfits: [], error: 'Necesitas al menos una parte de arriba y una de abajo (o un vestido) para crear outfits.' }
  }
  const base = items.find((i) => i.id === baseItemId)
  const w = (i) => 0.15 + tagFit(i.occasions, occasion) * tagFit(i.climates, climate) + (i.favorite ? 0.15 : 0)

  const seen = new Map()
  for (let n = 0; n < 500; n++) {
    const chosen = []
    let useOne
    if (base?.category === 'onepiece') useOne = true
    else if (base?.category === 'tops' || base?.category === 'bottoms') useOne = false
    else useOne = !canSeparates || (ones.length > 0 && Math.random() < ones.length / (ones.length + Math.min(tops.length, bottoms.length) * 2))
    if (useOne && ones.length === 0) continue
    if (!useOne && !canSeparates) continue

    if (useOne) chosen.push(base?.category === 'onepiece' ? base : pick(ones, w))
    else {
      chosen.push(base?.category === 'tops' ? base : pick(tops, w))
      chosen.push(base?.category === 'bottoms' ? base : pick(bottoms, w))
    }
    const optional = (list, cat, prob) => {
      if (base?.category === cat) chosen.push(base)
      else if (list.length && Math.random() < prob) chosen.push(pick(list, w))
    }
    optional(shoes, 'shoes', 1)
    optional(outer, 'outerwear', climate === 'frio' ? 1 : climate === 'calor' ? 0 : 0.45)
    optional(bags, 'bags', 0.5)
    optional(accs, 'accessories', 0.35)

    const key = chosen.map((i) => i.id).sort().join('|')
    if (seen.has(key)) continue

    // Puntuación
    const cols = chosen.map(colorOf)
    let h = 0, pairs = 0
    for (let a = 0; a < cols.length; a++) for (let b = a + 1; b < cols.length; b++) { h += harmony(cols[a], cols[b]); pairs++ }
    const harm = pairs ? h / pairs : 0.8
    const accents = new Set(cols.filter((c) => c.kind !== 'neutral').map((c) => c.id)).size
    const avg = (fn) => chosen.reduce((s, i) => s + fn(i), 0) / chosen.length
    const raw =
      harm * 40 +
      (accents <= 1 ? 10 : accents === 2 ? 4 : -15) +
      avg((i) => tagFit(i.occasions, occasion)) * 25 +
      avg((i) => tagFit(i.climates, climate)) * 20 +
      avg((i) => 1 / (1 + (wear[i.id]?.count || 0))) * 6 +
      avg((i) => (i.favorite ? 1 : 0)) * 3
    seen.set(key, { items: chosen, raw, score: raw + Math.random() * 6 })
  }

  // Elegimos los mejores procurando variedad entre ellos.
  const pool = [...seen.values()].sort((a, b) => b.score - a.score).slice(0, 80)
  const result = []
  const coreOf = (c) => c.items.filter((i) => ['tops', 'bottoms', 'onepiece'].includes(i.category) && i.id !== baseItemId).map((i) => i.id)
  while (result.length < count && pool.length) {
    let bestIdx = 0, bestVal = -Infinity
    pool.forEach((cand, idx) => {
      const core = coreOf(cand)
      const overlap = result.reduce((s, r) => s + coreOf(r).filter((id) => core.includes(id)).length, 0)
      const val = cand.score - overlap * 9
      if (val > bestVal) { bestVal = val; bestIdx = idx }
    })
    result.push(pool.splice(bestIdx, 1)[0])
  }

  return {
    outfits: result.map((r) => ({
      itemIds: r.items.map((i) => i.id),
      layout: autoLayout(r.items),
      affinity: Math.max(52, Math.min(99, Math.round(50 + r.raw * 0.47))),
      ...describe(r.items, opts),
    })),
  }
}

/* ---------- Colocación automática en el lienzo (3:4) ---------- */
// x, y = centro (0–1 del ancho/alto), s = lado de la casilla (0–1 del ancho)
const SLOTS = {
  separatesOuter: { tops: [0.31, 0.27, 0.5], bottoms: [0.31, 0.71, 0.54], outerwear: [0.75, 0.26, 0.46], shoes: [0.76, 0.82, 0.3], bags: [0.68, 0.57, 0.24], accessories: [0.9, 0.57, 0.17] },
  separates: { tops: [0.36, 0.27, 0.56], bottoms: [0.36, 0.72, 0.56], shoes: [0.8, 0.81, 0.3], bags: [0.8, 0.5, 0.27], accessories: [0.8, 0.2, 0.22] },
  oneOuter: { onepiece: [0.33, 0.47, 0.62], outerwear: [0.77, 0.25, 0.42], shoes: [0.78, 0.83, 0.28], bags: [0.7, 0.57, 0.23], accessories: [0.91, 0.57, 0.16], tops: [0.3, 0.25, 0.4], bottoms: [0.3, 0.7, 0.4] },
  one: { onepiece: [0.37, 0.47, 0.68], shoes: [0.81, 0.81, 0.29], bags: [0.81, 0.5, 0.26], accessories: [0.81, 0.2, 0.21], tops: [0.3, 0.25, 0.4], bottoms: [0.3, 0.7, 0.4] },
}

export function autoLayout(items) {
  const has = (c) => items.some((i) => i.category === c)
  const key = has('onepiece') && !(has('tops') && has('bottoms'))
    ? (has('outerwear') ? 'oneOuter' : 'one')
    : (has('outerwear') ? 'separatesOuter' : 'separates')
  const slots = SLOTS[key]
  const used = {}
  const order = ['bottoms', 'onepiece', 'tops', 'outerwear', 'bags', 'shoes', 'accessories']
  return [...items]
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category))
    .map((item) => {
      const [x, y, s] = slots[item.category] || [0.5, 0.5, 0.35]
      const n = used[item.category] || 0
      used[item.category] = n + 1
      return { itemId: item.id, x: Math.min(0.9, x + n * 0.07), y: Math.min(0.9, y + n * 0.06), s }
    })
}
