// Armario de ejemplo: prendas dibujadas en SVG para poder probar la app sin subir fotos.
import { COLOR, uid } from './constants'
import { processImage } from './image'

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)))
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

const SHAPES = {
  tee: (c, d) => `<path d="M70 30 40 42 14 76l24 20 14-14v90h96V82l14 14 24-20-26-34-30-12c-8 14-52 14-60 0Z" fill="${c}"/><path d="M70 30c8 14 52 14 60 0" fill="none" stroke="${d}" stroke-width="3"/>`,
  sweater: (c, d) => `<path d="M72 28 44 38 18 150l24 8 14-62v78h88V96l14 62 24-8-26-112-28-10c-8 14-48 14-56 0Z" fill="${c}"/><path d="M72 28c8 14 48 14 56 0M56 164h88" fill="none" stroke="${d}" stroke-width="3"/>`,
  shirt: (c, d) => `<path d="M72 28 44 38 18 150l24 8 14-62v78h88V96l14 62 24-8-26-112-28-10-28 22Z" fill="${c}"/><path d="M72 28l28 22 28-22M100 50v124" fill="none" stroke="${d}" stroke-width="3"/><circle cx="100" cy="78" r="2.4" fill="${d}"/><circle cx="100" cy="106" r="2.4" fill="${d}"/><circle cx="100" cy="134" r="2.4" fill="${d}"/>`,
  jacket: (c, d) => `<path d="M72 28 44 38 18 150l24 8 14-62v78h88V96l14 62 24-8-26-112-28-10-28 40Z" fill="${c}"/><path d="M72 28l28 40 28-40M100 68v106M66 120h22M112 120h22" fill="none" stroke="${d}" stroke-width="3"/>`,
  coat: (c, d) => `<path d="M74 16 46 26 20 150l24 8 12-58v88h88V100l12 58 24-8-26-124-28-10-26 44Z" fill="${c}"/><path d="M74 16l26 44 26-44M100 60v128M64 132h20M116 132h20" fill="none" stroke="${d}" stroke-width="3"/>`,
  pants: (c, d) => `<path d="M62 16h76l12 170h-38L100 70 88 186H50Z" fill="${c}"/><path d="M62 30h76M100 30v40" fill="none" stroke="${d}" stroke-width="3"/>`,
  shorts: (c, d) => `<path d="M56 50h88l12 92h-48l-8-46-8 46H44Z" fill="${c}"/><path d="M56 64h88M100 64v32" fill="none" stroke="${d}" stroke-width="3"/>`,
  skirt: (c, d) => `<path d="M70 40h60l34 112H36Z" fill="${c}"/><path d="M70 54h60" fill="none" stroke="${d}" stroke-width="3"/>`,
  dress: (c, d) => `<path d="M72 14h10c2 18 34 18 36 0h10l6 46-14 24 36 102H44L80 84 66 60Z" fill="${c}"/><path d="M80 84h40" fill="none" stroke="${d}" stroke-width="3"/>`,
  sneaker: (c, d) => `<path d="M20 120c0-20 14-24 24-20l40-14c12 14 36 26 66 30 22 2 34 12 34 26v8H20Z" fill="${c}"/><path d="M20 150h164v8a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6Z" fill="${d}"/><path d="M92 96l-10 12M106 104l-10 12M120 110l-8 12" fill="none" stroke="${d}" stroke-width="3" stroke-linecap="round"/>`,
  boot: (c, d) => `<path d="M60 30h52v74c18 12 56 14 60 40v8H60Z" fill="${c}"/><path d="M60 152h112v6a6 6 0 0 1-6 6H66a6 6 0 0 1-6-6Z" fill="${d}"/><path d="M60 46h52" fill="none" stroke="${d}" stroke-width="3"/>`,
  bag: (c, d) => `<path d="M70 86c0-56 60-56 60 0" fill="none" stroke="${d}" stroke-width="7" stroke-linecap="round"/><path d="M40 84h120l10 92H30Z" fill="${c}"/><path d="M40 100h120" fill="none" stroke="${d}" stroke-width="3"/>`,
  cap: (c, d) => `<path d="M36 124c0-70 114-70 114 0Z" fill="${c}"/><path d="M150 124c26-2 40 6 42 14l-42-2Z" fill="${d}"/><path d="M93 72v52" fill="none" stroke="${d}" stroke-width="3"/>`,
}

function svgFor(shape, colorId) {
  const hex = COLOR[colorId].hex
  const light = ['blanco', 'beige', 'celeste', 'rosa', 'amarillo'].includes(colorId)
  const detail = shade(hex, light ? -0.16 : colorId === 'negro' ? 0.2 : -0.12)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="600" height="600"><g stroke="${shade(hex, light ? -0.2 : -0.06)}" stroke-width="1.5" stroke-linejoin="round">${SHAPES[shape](hex, detail)}</g></svg>`
}

const LIST = [
  ['Camiseta blanca básica', 'tops', 'Camiseta', 'tee', 'blanco', ['calor', 'templado'], ['casual', 'casa', 'viaje'], 15],
  ['Camiseta negra', 'tops', 'Camiseta', 'tee', 'negro', ['calor', 'templado'], ['casual', 'fiesta'], 15],
  ['Camisa celeste', 'tops', 'Camisa', 'shirt', 'celeste', ['templado', 'calor'], ['trabajo', 'formal', 'cita'], 45],
  ['Camisa blanca', 'tops', 'Camisa', 'shirt', 'blanco', ['templado'], ['trabajo', 'formal', 'cita'], 40],
  ['Suéter beige', 'tops', 'Suéter', 'sweater', 'beige', ['frio', 'templado'], ['casual', 'trabajo', 'cita'], 55],
  ['Sudadera gris', 'tops', 'Sudadera', 'sweater', 'gris', ['frio', 'templado'], ['casual', 'deporte', 'casa'], 40],
  ['Suéter verde', 'tops', 'Suéter', 'sweater', 'verde', ['frio'], ['casual', 'cita'], 50],
  ['Jeans azules', 'bottoms', 'Jeans', 'pants', 'denim', ['templado', 'frio', 'calor'], ['casual', 'cita', 'viaje'], 60],
  ['Pantalón negro', 'bottoms', 'Pantalón', 'pants', 'negro', ['templado', 'frio'], ['trabajo', 'formal', 'fiesta'], 50],
  ['Pantalón beige', 'bottoms', 'Pantalón', 'pants', 'beige', ['templado', 'calor'], ['casual', 'trabajo'], 45],
  ['Shorts oliva', 'bottoms', 'Shorts', 'shorts', 'oliva', ['calor'], ['casual', 'viaje'], 30],
  ['Falda negra', 'bottoms', 'Falda', 'skirt', 'negro', ['calor', 'templado'], ['fiesta', 'cita', 'trabajo'], 35],
  ['Vestido burdeos', 'onepiece', 'Vestido', 'dress', 'burdeos', ['calor', 'templado'], ['fiesta', 'cita', 'formal'], 80],
  ['Chaqueta denim', 'outerwear', 'Chaqueta', 'jacket', 'denim', ['templado'], ['casual', 'viaje'], 70],
  ['Blazer negro', 'outerwear', 'Blazer', 'jacket', 'negro', ['templado', 'frio'], ['trabajo', 'formal', 'fiesta'], 95],
  ['Abrigo camel', 'outerwear', 'Abrigo', 'coat', 'marron', ['frio'], ['trabajo', 'formal', 'casual', 'cita'], 140],
  ['Tenis blancos', 'shoes', 'Tenis', 'sneaker', 'blanco', ['calor', 'templado', 'frio'], ['casual', 'viaje', 'deporte'], 85],
  ['Botas negras', 'shoes', 'Botas', 'boot', 'negro', ['frio', 'templado'], ['casual', 'fiesta', 'trabajo', 'cita'], 110],
  ['Botas marrones', 'shoes', 'Botas', 'boot', 'marron', ['frio', 'templado'], ['casual', 'trabajo'], 105],
  ['Bolso negro', 'bags', 'Bolso', 'bag', 'negro', [], ['trabajo', 'formal', 'fiesta', 'cita'], 65],
  ['Tote beige', 'bags', 'Tote', 'bag', 'beige', [], ['casual', 'viaje'], 30],
  ['Gorra azul marino', 'accessories', 'Gorra', 'cap', 'marino', ['calor', 'templado'], ['casual', 'deporte', 'viaje'], 20],
]

export async function buildSamples() {
  const out = []
  let t = Date.now()
  for (const [name, category, sub, shape, color, climates, occasions, price] of LIST) {
    const svg = new Blob([svgFor(shape, color)], { type: 'image/svg+xml' })
    const { blob } = await processImage(svg, { size: 600 })
    out.push({
      id: uid(), name, category, sub, colors: [color], climates, occasions,
      brand: '', size: '', price, notes: '', favorite: false, wornDates: [],
      image: blob, cutout: true, sample: true, createdAt: t--,
    })
  }
  return out
}
