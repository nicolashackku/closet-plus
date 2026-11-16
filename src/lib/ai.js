// IA opcional con Google Gemini (clave gratuita de aistudio.google.com) y clima con Open-Meteo.
import { CATEGORIES, CAT, COLORS, COLOR, CLIMATES, CLIMATE, OCCASIONS, OCCASION } from './constants'
import { toCanvas } from './image'
import { autoLayout } from './stylist'

const FALLBACK_MODELS = ['gemini-flash-lite-latest', 'gemini-flash-latest']
export const DEFAULT_MODEL = 'automático'
// Clave incluida en el proyecto (.env.local). Una clave escrita en el Perfil tiene prioridad.
export const BUILT_IN_KEY = (import.meta.env.VITE_GEMINI_KEY || '').trim()

async function gemini(settings, parts, temperature = 0.8) {
  const key = settings.geminiKey?.trim() || BUILT_IN_KEY
  if (!key) throw new Error('Añade tu clave de Gemini en Perfil → Inteligencia artificial.')
  // Sin modelo elegido probamos varios: si uno está saturado o tarda, pasamos al siguiente.
  const models = settings.geminiModel?.trim() ? [settings.geminiModel.trim()] : FALLBACK_MODELS
  let res, model, lastError
  for (model of models) {
    try {
      res = await request(key, model, parts, temperature)
      lastError = null
      if (![500, 503, 404, 429].includes(res.status)) break
    } catch (e) {
      lastError = e
    }
  }
  if (lastError) throw lastError
  if (!res.ok) {
    let msg = ''
    try { msg = (await res.json()).error?.message || '' } catch { /* sin detalle */ }
    if (res.status === 400 && /API key/i.test(msg)) throw new Error('La clave de Gemini no es válida.')
    if (res.status === 401 || res.status === 403) throw new Error('La clave de Gemini no es válida o no tiene permiso para este modelo.')
    if (res.status === 404) throw new Error(`El modelo "${model}" no existe. Cámbialo en Perfil.`)
    if (res.status === 429) throw new Error('Se alcanzó el límite gratuito de Gemini. Prueba en un minuto.')
    if (res.status === 503 || res.status === 500) throw new Error('Gemini está saturado en este momento. Prueba de nuevo en un rato.')
    throw new Error(msg || `Gemini respondió con un error (${res.status}).`)
  }
  const data = await res.json()
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('')
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''))
  } catch {
    throw new Error('Gemini devolvió una respuesta que no se pudo leer. Inténtalo de nuevo.')
  }
}

async function request(key, model, parts, temperature) {
  // Tope de espera: si Gemini no contesta, la app sigue con el estilista propio.
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 30000)
  try {
    return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', temperature },
      }),
      signal: ctrl.signal,
    })
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Gemini tardó demasiado en responder.')
    throw new Error('No se pudo conectar con Gemini. Revisa tu conexión.')
  } finally {
    clearTimeout(timer)
  }
}

export async function testGemini(settings) {
  const out = await gemini(settings, [{ text: 'Responde solo con este JSON: {"ok": true}' }], 0)
  return out?.ok === true
}

/** Outfits propuestos por Gemini a partir de la lista de prendas (solo texto, sin fotos). */
export async function aiOutfits(items, settings, { occasion, climate, temp, baseItemId, count = 6, note }) {
  const short = new Map(items.map((it, i) => [`p${i + 1}`, it]))
  const list = [...short].map(([id, it]) => ({
    id,
    nombre: it.name,
    categoria: CAT[it.category]?.name,
    tipo: it.sub || undefined,
    colores: (it.colors || []).map((c) => COLOR[c]?.name),
    clima: (it.climates || []).map((c) => CLIMATE[c]?.name),
    ocasiones: (it.occasions || []).map((c) => OCCASION[c]?.name),
    favorita: it.favorite || undefined,
  }))
  const baseId = [...short].find(([, it]) => it.id === baseItemId)?.[0]
  const prompt = `Eres una estilista de moda con muy buen gusto. Con las prendas de este armario crea ${count} outfits distintos entre sí.

Contexto:
- Ocasión: ${occasion ? OCCASION[occasion].name : 'cualquiera'}
- Clima: ${climate ? CLIMATE[climate].name : 'cualquiera'}${temp != null ? ` (${Math.round(temp)} °C ahora)` : ''}
${baseId ? `- Todos los outfits deben incluir la prenda ${baseId}.` : ''}${note ? `\n- Petición de la persona: ${note}` : ''}

Reglas:
- Cada outfit lleva una parte de arriba y una de abajo, o bien un vestido/enterizo. Añade zapatos si hay. Abrigo solo si el clima lo pide. Bolso y accesorios son opcionales.
- Máximo una prenda por categoría (salvo accesorios).
- Cuida la armonía de color y que el nivel de formalidad sea coherente.
- Usa solo ids de la lista.

Armario:
${JSON.stringify(list)}

Responde solo con JSON así:
{"outfits":[{"nombre":"nombre corto y evocador","prendas":["p1","p2"],"motivo":"una o dos frases en español explicando por qué funciona"}]}`

  const out = await gemini(settings, [{ text: prompt }])
  const outfits = (out.outfits || [])
    .map((o) => {
      const chosen = [...new Set(o.prendas || [])].map((id) => short.get(id)).filter(Boolean)
      return { name: String(o.nombre || 'Outfit'), reason: String(o.motivo || ''), items: chosen }
    })
    .filter((o) => o.items.length >= 2 || o.items.some((i) => i.category === 'onepiece'))
    .map((o) => ({ name: o.name, reason: o.reason, itemIds: o.items.map((i) => i.id), layout: autoLayout(o.items), ai: true }))
  if (!outfits.length) throw new Error('Gemini no propuso outfits válidos. Inténtalo de nuevo.')
  return outfits
}

/** Rellena los datos de una prenda mirando su foto. */
export async function aiTagItem(blob, settings) {
  const canvas = await toCanvas(blob, 640)
  const flat = document.createElement('canvas')
  flat.width = canvas.width; flat.height = canvas.height
  const ctx = flat.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, flat.width, flat.height)
  ctx.drawImage(canvas, 0, 0)
  const data = flat.toDataURL('image/jpeg', 0.85).split(',')[1]
  const prompt = `Describe la prenda principal de la foto para una app de armario. Responde solo con JSON:
{"nombre":"nombre corto en español, p. ej. 'Camisa de lino blanca'","categoria":"uno de: ${CATEGORIES.map((c) => c.id).join(', ')}","tipo":"uno de los tipos de esa categoría","colores":["1 o 2 de: ${COLORS.map((c) => c.id).join(', ')}"],"clima":["de: ${CLIMATES.map((c) => c.id).join(', ')}"],"ocasiones":["de: ${OCCASIONS.map((c) => c.id).join(', ')}"],"marca":"solo si se ve claramente, si no cadena vacía"}
Tipos por categoría: ${CATEGORIES.map((c) => `${c.id}: ${c.subs.join('/')}`).join('; ')}`
  const o = await gemini(settings, [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data } }], 0.2)
  const cat = CAT[o.categoria] ? o.categoria : undefined
  const only = (arr, dict) => (Array.isArray(arr) ? arr.filter((x) => dict[x]) : [])
  return {
    name: typeof o.nombre === 'string' ? o.nombre.slice(0, 60) : undefined,
    category: cat,
    sub: cat && CAT[cat].subs.includes(o.tipo) ? o.tipo : undefined,
    colors: only(o.colores, COLOR).slice(0, 2),
    climates: only(o.clima, CLIMATE),
    occasions: only(o.ocasiones, OCCASION),
    brand: typeof o.marca === 'string' ? o.marca.slice(0, 40) : '',
  }
}

/* ---------- Clima actual (Open-Meteo, gratis y sin clave) ---------- */
const WEATHER_TEXT = [
  [[0], 'Despejado'], [[1, 2], 'Poco nublado'], [[3], 'Nublado'], [[45, 48], 'Niebla'],
  [[51, 53, 55, 56, 57], 'Llovizna'], [[61, 63, 65, 66, 67, 80, 81, 82], 'Lluvia'],
  [[71, 73, 75, 77, 85, 86], 'Nieve'], [[95, 96, 99], 'Tormenta'],
]

export function getWeather() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Este navegador no permite obtener la ubicación.'))
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          // Coordenadas redondeadas (~10 km): suficiente para el clima.
          const lat = pos.coords.latitude.toFixed(1)
          const lon = pos.coords.longitude.toFixed(1)
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`)
          if (!res.ok) throw new Error()
          const cur = (await res.json()).current
          const temp = cur.temperature_2m
          const text = WEATHER_TEXT.find(([codes]) => codes.includes(cur.weather_code))?.[1] || ''
          resolve({ temp, text, climate: temp >= 24 ? 'calor' : temp >= 15 ? 'templado' : 'frio' })
        } catch {
          reject(new Error('No se pudo consultar el clima.'))
        }
      },
      () => reject(new Error('No se pudo acceder a tu ubicación.')),
      { timeout: 10000, maximumAge: 30 * 60 * 1000 },
    )
  })
}
