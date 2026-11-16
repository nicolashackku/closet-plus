// Pequeña capa sobre IndexedDB: todo se guarda en este navegador, sin servidor.
const NAME = 'closet-plus'
const VERSION = 1
export const STORES = ['items', 'outfits', 'plans', 'kv']

let dbPromise
function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('items')) db.createObjectStore('items', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('outfits')) db.createObjectStore('outfits', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('plans')) db.createObjectStore('plans', { keyPath: 'date' })
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'key' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

async function run(store, mode, fn) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const result = fn(tx.objectStore(store))
    tx.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export const getAll = (store) => run(store, 'readonly', (s) => s.getAll())
export const put = (store, value) => run(store, 'readwrite', (s) => s.put(value))
export const putMany = (store, values) => run(store, 'readwrite', (s) => { values.forEach((v) => s.put(v)) })
export const del = (store, key) => run(store, 'readwrite', (s) => s.delete(key))
export const clear = (store) => run(store, 'readwrite', (s) => s.clear())

export async function getKv(key, fallback) {
  const row = await run('kv', 'readonly', (s) => s.get(key))
  return row ? row.value : fallback
}
export const setKv = (key, value) => put('kv', { key, value })

// Pide al navegador que no borre los datos si falta espacio.
export function requestPersistence() {
  try { navigator.storage?.persist?.() } catch { /* opcional */ }
}
