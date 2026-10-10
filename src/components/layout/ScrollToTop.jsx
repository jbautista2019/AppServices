import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

const MODAL_PATHS = ['/cuenta', '/registro']

// Al cambiar de página vuelve al inicio. No se mueve al abrir o cerrar los modales de cuenta (la página de fondo se queda donde estaba)
// ni al cambiar la conversación seleccionada en /mensajes; en /buscar sí se sube cuando cambia la consulta.
export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation()
  const previous = useRef({ pathname, search })

  useEffect(() => {
    const before = previous.current
    previous.current = { pathname, search }
    if (hash) return
    if (MODAL_PATHS.includes(pathname) || MODAL_PATHS.includes(before.pathname)) return

    const pageChanged = pathname !== before.pathname
    const searchChanged = pathname === '/buscar' && search !== before.search
    if (pageChanged || searchChanged) window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname, search, hash])

  return null
}
