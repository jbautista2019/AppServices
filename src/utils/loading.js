// Estado global de "cargando" para acciones iniciadas por el usuario (clic en botón/enlace o envío de formulario).
// Las peticiones de fondo (tiempo real, refrescos automáticos) no lo activan: solo cuentan las que
// empiezan poco después de una interacción.
const ARM_WINDOW_MS = 1200

let pending = 0
let armedUntil = 0
const listeners = new Set()

function notify() {
  listeners.forEach((listener) => listener(pending))
}

export function subscribeLoading(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getPendingCount() {
  return pending
}

export function armLoading() {
  armedUntil = Date.now() + ARM_WINDOW_MS
}

export function trackedFetch(...args) {
  if (Date.now() > armedUntil) return fetch(...args)

  pending += 1
  notify()
  return fetch(...args).finally(() => {
    pending = Math.max(0, pending - 1)
    notify()
  })
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('button, a, [role="button"], input[type="submit"]')) armLoading()
  }, true)
  document.addEventListener('submit', armLoading, true)
}
