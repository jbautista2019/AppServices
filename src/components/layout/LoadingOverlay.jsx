import { useEffect, useState } from 'react'
import { getPendingCount, subscribeLoading } from '../../utils/loading'

const SHOW_DELAY_MS = 150
const MAX_VISIBLE_MS = 30000

export default function LoadingOverlay() {
  const [pending, setPending] = useState(getPendingCount())
  const [visible, setVisible] = useState(false)

  useEffect(() => subscribeLoading(setPending), [])

  // Se muestra tras un pequeño retraso para no parpadear en respuestas rápidas, y nunca queda atascado.
  useEffect(() => {
    if (!pending) {
      setVisible(false)
      return
    }
    const showTimer = setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    const hideTimer = setTimeout(() => setVisible(false), MAX_VISIBLE_MS)
    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
    }
  }, [pending])

  if (!visible) return null

  return <div className="loading-overlay" role="status" aria-live="polite" aria-label="Cargando">
    <div className="loading-spinner" aria-hidden="true" />
    <span className="loading-text">Cargando...</span>
  </div>
}
