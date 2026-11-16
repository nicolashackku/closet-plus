export const CATEGORIES = [
  { id: 'tops', name: 'Partes de arriba', short: 'Arriba', one: 'Parte de arriba', subs: ['Camiseta', 'Camisa', 'Blusa', 'Top', 'Polo', 'Suéter', 'Sudadera', 'Cárdigan'] },
  { id: 'bottoms', name: 'Partes de abajo', short: 'Abajo', one: 'Parte de abajo', subs: ['Jeans', 'Pantalón', 'Shorts', 'Falda', 'Leggings', 'Joggers'] },
  { id: 'onepiece', name: 'Vestidos y enterizos', short: 'Vestidos', one: 'Vestido', subs: ['Vestido', 'Enterizo', 'Conjunto'] },
  { id: 'outerwear', name: 'Abrigos y chaquetas', short: 'Abrigos', one: 'Abrigo', subs: ['Chaqueta', 'Blazer', 'Abrigo', 'Gabardina', 'Chaleco', 'Impermeable'] },
  { id: 'shoes', name: 'Zapatos', short: 'Zapatos', one: 'Zapatos', subs: ['Tenis', 'Botas', 'Sandalias', 'Tacones', 'Mocasines', 'Zapatos formales'] },
  { id: 'bags', name: 'Bolsos', short: 'Bolsos', one: 'Bolso', subs: ['Bolso', 'Mochila', 'Cartera', 'Tote', 'Riñonera'] },
  { id: 'accessories', name: 'Accesorios', short: 'Accesorios', one: 'Accesorio', subs: ['Gorra', 'Sombrero', 'Bufanda', 'Cinturón', 'Gafas', 'Joyería', 'Reloj'] },
]
export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))

// kind: neutral (va con todo) | earth | color | pastel | multi
export const COLORS = [
  { id: 'negro', name: 'Negro', hex: '#151515', kind: 'neutral' },
  { id: 'blanco', name: 'Blanco', hex: '#FFFFFF', kind: 'neutral' },
  { id: 'gris', name: 'Gris', hex: '#9B9B9B', kind: 'neutral' },
  { id: 'beige', name: 'Beige', hex: '#DCCBAE', kind: 'neutral' },
  { id: 'marron', name: 'Marrón', hex: '#7A4E2D', kind: 'earth', hue: 25 },
  { id: 'marino', name: 'Azul marino', hex: '#1F2A44', kind: 'neutral' },
  { id: 'denim', name: 'Denim', hex: '#5B7FA6', kind: 'neutral' },
  { id: 'azul', name: 'Azul', hex: '#2F6FD0', kind: 'color', hue: 216 },
  { id: 'celeste', name: 'Celeste', hex: '#AFD0EC', kind: 'pastel', hue: 207 },
  { id: 'verde', name: 'Verde', hex: '#2E8B57', kind: 'color', hue: 146 },
  { id: 'oliva', name: 'Oliva', hex: '#6B7A3A', kind: 'earth', hue: 74 },
  { id: 'rojo', name: 'Rojo', hex: '#D0312D', kind: 'color', hue: 2 },
  { id: 'burdeos', name: 'Burdeos', hex: '#6E1F2B', kind: 'earth', hue: 351 },
  { id: 'rosa', name: 'Rosa', hex: '#F2A7BD', kind: 'pastel', hue: 342 },
  { id: 'morado', name: 'Morado', hex: '#7B4FB3', kind: 'color', hue: 266 },
  { id: 'amarillo', name: 'Amarillo', hex: '#F2CF3B', kind: 'color', hue: 49 },
  { id: 'naranja', name: 'Naranja', hex: '#F08A2E', kind: 'color', hue: 28 },
  { id: 'multi', name: 'Estampado', hex: 'conic-gradient(#f2a7bd, #f2cf3b, #7fc8a9, #7aa7e0, #b08ae0, #f2a7bd)', kind: 'multi' },
]
export const COLOR = Object.fromEntries(COLORS.map((c) => [c.id, c]))

export const CLIMATES = [
  { id: 'calor', name: 'Calor' },
  { id: 'templado', name: 'Templado' },
  { id: 'frio', name: 'Frío' },
]
export const CLIMATE = Object.fromEntries(CLIMATES.map((c) => [c.id, c]))

export const OCCASIONS = [
  { id: 'casual', name: 'Casual' },
  { id: 'trabajo', name: 'Trabajo' },
  { id: 'formal', name: 'Formal' },
  { id: 'fiesta', name: 'Fiesta' },
  { id: 'cita', name: 'Cita' },
  { id: 'deporte', name: 'Deporte' },
  { id: 'viaje', name: 'Viaje' },
  { id: 'casa', name: 'En casa' },
]
export const OCCASION = Object.fromEntries(OCCASIONS.map((c) => [c.id, c]))

export const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
export const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2))

export function ymd(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function prettyDate(s) {
  const d = parseYmd(s)
  const today = ymd()
  if (s === today) return 'Hoy'
  const t = new Date(); t.setDate(t.getDate() + 1)
  if (s === ymd(t)) return 'Mañana'
  const y = new Date(); y.setDate(y.getDate() - 1)
  if (s === ymd(y)) return 'Ayer'
  return d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
}
export function shortDate(s) {
  if (s === ymd()) return 'Hoy'
  const y = new Date(); y.setDate(y.getDate() - 1)
  if (s === ymd(y)) return 'Ayer'
  return parseYmd(s).toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', '')
}
export const money = (n) => new Intl.NumberFormat('es', { maximumFractionDigits: 0 }).format(Math.round(n || 0))
