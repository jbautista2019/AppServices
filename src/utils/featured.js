// Selección de los servicios que salen en «Profesionales más buscados» de la portada.
//
// Reglas:
//  1. Las publicaciones premium vigentes (premium_until en el futuro) van primero. Se reparten por rotación diaria, para que ninguna
//     tenga siempre el primer lugar, y ocupan como máximo el 75% de los lugares: siempre quedan espacios para el resto.
//  2. El resto se completa con las mejor valoradas, repartidas entre categorías (una por categoría primero) para mostrar variedad de oficios.

export const PREMIUM_SHARE = 0.75

export function isPremium(service, now = Date.now()) {
  const until = service?.premium_until ? Date.parse(service.premium_until) : Number.NaN
  return Number.isFinite(until) && until > now
}

// Hash estable con buena dispersión (FNV-1a + mezcla final de murmur3) para ordenar de forma pseudoaleatoria pero repetible dentro del
// mismo día. Con un hash débil, cambiar el día apenas cambiaba el orden y la rotación no repartía los lugares con equidad.
function stableHash(text) {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193)
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x85ebca6b)
  hash ^= hash >>> 13
  hash = Math.imul(hash, 0xc2b2ae35)
  hash ^= hash >>> 16
  return hash >>> 0
}

function pickByCategoryVariety(services, limit) {
  const byCategory = new Map()
  for (const service of [...services].sort((first, second) => Number(second.rating) - Number(first.rating))) {
    if (!byCategory.has(service.category)) byCategory.set(service.category, [])
    byCategory.get(service.category).push(service)
  }

  const groups = [...byCategory.values()]
  const picked = []
  for (let round = 0; picked.length < limit && groups.some((group) => group[round]); round += 1) {
    for (const group of groups) {
      if (group[round] && picked.length < limit) picked.push(group[round])
    }
  }
  return picked
}

export function pickFeaturedServices(services, limit, { now = Date.now(), dayKey = new Date(now).toISOString().slice(0, 10) } = {}) {
  const premium = services
    .filter((service) => isPremium(service, now))
    .sort((first, second) => stableHash(`${dayKey}:${first.id}`) - stableHash(`${dayKey}:${second.id}`))
    .slice(0, Math.ceil(limit * PREMIUM_SHARE))

  const taken = new Set(premium.map((service) => service.id))
  const organic = pickByCategoryVariety(services.filter((service) => !taken.has(service.id)), limit - premium.length)
  return [...premium, ...organic]
}
