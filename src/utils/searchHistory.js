// Historial de búsquedas guardado solo en este navegador (localStorage); nunca se envía al servidor.
const HISTORY_KEY = 'oficios-cerca:search-history'
export const HISTORY_LIMIT = 8
export const SUGGESTION_LIMIT = 8

function normalize(text) {
  return String(text || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

function readHistory() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item.trim()) : []
  } catch {
    return []
  }
}

function writeHistory(items) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items))
  } catch {
    // Almacenamiento bloqueado o lleno: el historial es solo una comodidad.
  }
}

export function getSearchHistory() {
  return readHistory().slice(0, HISTORY_LIMIT)
}

// Guarda la búsqueda al principio, sin duplicados (sin distinguir mayúsculas ni tildes) y respetando el límite.
export function addSearchHistory(term) {
  const clean = String(term || '').trim().replace(/\s+/g, ' ')
  if (clean.length < 2) return getSearchHistory()

  const key = normalize(clean)
  const next = [clean, ...readHistory().filter((item) => normalize(item) !== key)].slice(0, HISTORY_LIMIT)
  writeHistory(next)
  return next
}

export function removeSearchHistory(term) {
  const key = normalize(term)
  const next = readHistory().filter((item) => normalize(item) !== key)
  writeHistory(next)
  return next.slice(0, HISTORY_LIMIT)
}

export function clearSearchHistory() {
  writeHistory([])
  return []
}

// Sugerencias para lo que se está escribiendo: primero el historial que coincide, luego categorías y títulos de servicios.
// Las que empiezan con el texto van antes que las que solo lo contienen.
export function buildSuggestions({ term, history = [], services = [], categories = [] }) {
  const query = normalize(term)
  if (!query) return []

  const seen = new Set()
  const rank = (label) => (normalize(label).startsWith(query) ? 0 : 1)
  const collect = (labels, type) => labels
    .filter((label) => label && normalize(label).includes(query))
    .sort((first, second) => rank(first) - rank(second))
    .map((label) => ({ type, label }))
    .filter((item) => {
      const key = normalize(item.label)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  return [
    ...collect(history, 'history'),
    ...collect(categories.map((category) => category.name), 'category'),
    ...collect(services.map((service) => service.title), 'service'),
  ].slice(0, SUGGESTION_LIMIT)
}
