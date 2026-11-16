import { COLORS } from './constants'

/* ---------- URLs de blobs (cacheadas) ---------- */
const urlCache = new WeakMap()
export function blobUrl(blob) {
  if (!blob) return ''
  if (typeof blob === 'string') return blob
  let url = urlCache.get(blob)
  if (!url) { url = URL.createObjectURL(blob); urlCache.set(blob, url) }
  return url
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}
export async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl)
  return res.blob()
}

/* ---------- Carga y redimensionado ---------- */
function loadViaImg(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')) }
    img.src = url
  })
}
async function loadSource(blob) {
  if (blob.type !== 'image/svg+xml' && 'createImageBitmap' in window) {
    try { return await createImageBitmap(blob) } catch { /* probamos con <img> */ }
  }
  return loadViaImg(blob)
}

export async function toCanvas(blob, max = 1100, forceSize) {
  const src = await loadSource(blob)
  const sw = src.width || src.naturalWidth || forceSize || 600
  const sh = src.height || src.naturalHeight || forceSize || 600
  const scale = forceSize ? forceSize / Math.max(sw, sh) : Math.min(1, max / Math.max(sw, sh))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sw * scale))
  canvas.height = Math.max(1, Math.round(sh * scale))
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height)
  src.close?.()
  return canvas
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

function alphaInfo(canvas) {
  const { width: w, height: h } = canvas
  const data = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data
  let minX = w, minY = h, maxX = -1, maxY = -1, transparent = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 16) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      } else transparent++
    }
  }
  return { hasAlpha: transparent / (w * h) > 0.02, box: maxX < 0 ? null : { minX, minY, maxX, maxY } }
}

// Recorta los márgenes transparentes para que la prenda llene su casilla.
function trim(canvas, box) {
  if (!box) return canvas
  const pad = Math.round(Math.max(canvas.width, canvas.height) * 0.015)
  const x = Math.max(0, box.minX - pad)
  const y = Math.max(0, box.minY - pad)
  const w = Math.min(canvas.width, box.maxX + pad + 1) - x
  const h = Math.min(canvas.height, box.maxY + pad + 1) - y
  if (w >= canvas.width - 2 && h >= canvas.height - 2) return canvas
  const out = document.createElement('canvas')
  out.width = w; out.height = h
  out.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, w, h)
  return out
}

/** Prepara una foto para guardarla: tamaño razonable, recorte y colores detectados. */
export async function processImage(blob, { size } = {}) {
  let canvas = await toCanvas(blob, 1100, size)
  const info = alphaInfo(canvas)
  if (info.hasAlpha) canvas = trim(canvas, info.box)
  const out = info.hasAlpha
    ? (await canvasBlob(canvas, 'image/webp', 0.92)) || (await canvasBlob(canvas, 'image/png'))
    : await canvasBlob(canvas, 'image/jpeg', 0.88)
  return { blob: out, colors: detectColors(canvas), transparent: info.hasAlpha }
}

export async function makeAvatar(blob, size = 480) {
  const src = await toCanvas(blob, 1400)
  const side = Math.min(src.width, src.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = Math.min(size, side)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, (src.width - side) / 2, (src.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height)
  return canvasBlob(canvas, 'image/jpeg', 0.9)
}

/* ---------- Quitar fondo (modelo de IA que corre en el navegador, gratis) ---------- */
export async function removeBackground(blob, onProgress) {
  const mod = await import('@imgly/background-removal')
  const small = await canvasBlob(await toCanvas(blob, 1100), 'image/png')
  const cut = await mod.removeBackground(small, {
    output: { format: 'image/png' },
    progress: (key, current, total) => {
      if (onProgress && total) onProgress(key.startsWith('fetch') ? 'Descargando modelo' : 'Recortando', current / total)
    },
  })
  return processImage(cut)
}

/* ---------- Detección de color ---------- */
function rgbToLab(r, g, b) {
  let [x, y, z] = [r, g, b].map((v) => {
    v /= 255
    return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92
  })
  const X = (x * 0.4124 + y * 0.3576 + z * 0.1805) / 0.95047
  const Y = x * 0.2126 + y * 0.7152 + z * 0.0722
  const Z = (x * 0.0193 + y * 0.1192 + z * 0.9505) / 1.08883
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]
}
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const PALETTE = COLORS.filter((c) => c.hex.startsWith('#')).map((c) => ({ id: c.id, lab: rgbToLab(...hexToRgb(c.hex)) }))

function classify(r, g, b) {
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  const l = (max + min) / 2
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1))
  if (l < 0.12) return 'negro'
  if (l > 0.94) return 'blanco'
  if (s < 0.1) return l > 0.84 ? 'blanco' : l < 0.22 ? 'negro' : 'gris'
  const lab = rgbToLab(r, g, b)
  let best = 'gris', bestD = Infinity
  for (const p of PALETTE) {
    const d = (lab[0] - p.lab[0]) ** 2 * 0.7 + (lab[1] - p.lab[1]) ** 2 + (lab[2] - p.lab[2]) ** 2
    if (d < bestD) { bestD = d; best = p.id }
  }
  return best
}

export function detectColors(source) {
  const N = 56
  const c = document.createElement('canvas')
  c.width = c.height = N
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(source, 0, 0, N, N)
  const d = ctx.getImageData(0, 0, N, N).data
  const px = (x, y) => { const i = (y * N + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]] }

  // ¿Fondo uniforme? Miramos el borde de la foto.
  const border = []
  for (let i = 0; i < N; i++) border.push(px(i, 0), px(i, N - 1), px(0, i), px(N - 1, i))
  const opaqueBorder = border.filter((p) => p[3] > 200)
  let bg = null
  if (opaqueBorder.length > border.length * 0.6) {
    const med = [0, 1, 2].map((k) => opaqueBorder.map((p) => p[k]).sort((a, b) => a - b)[opaqueBorder.length >> 1])
    const close = opaqueBorder.filter((p) => Math.hypot(p[0] - med[0], p[1] - med[1], p[2] - med[2]) < 30).length
    if (close / opaqueBorder.length > 0.6) bg = med
  }

  const tally = {}
  let total = 0
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const [r, g, b, a] = px(x, y)
      if (a < 128) continue
      if (bg && Math.hypot(r - bg[0], g - bg[1], b - bg[2]) < 38) continue
      const dx = (x - N / 2) / (N / 2), dy = (y - N / 2) / (N / 2)
      const w = 1.4 - Math.min(1, dx * dx + dy * dy)
      const id = classify(r, g, b)
      tally[id] = (tally[id] || 0) + w
      total += w
    }
  }
  if (total < N * N * 0.03) return bg ? [classify(bg[0], bg[1], bg[2])] : []
  const ranked = Object.entries(tally).map(([id, w]) => ({ id, share: w / total })).sort((a, b) => b.share - a.share)
  if (ranked.filter((r) => r.share >= 0.14).length >= 4) return ['multi']
  const out = [ranked[0].id]
  if (ranked[1] && ranked[1].share >= 0.22 && ranked[1].share >= ranked[0].share * 0.4) out.push(ranked[1].id)
  return out
}
