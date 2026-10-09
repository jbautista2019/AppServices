import { useLocation, useNavigate } from 'react-router-dom'
import { useFavorites } from '../../context/FavoritesContext'

// Corazón para guardar o quitar un servicio de favoritos. Sin sesión lleva a iniciar sesión.
export default function FavoriteButton({ service, labeled = false }) {
  const { loggedIn, isFavorite, toggle } = useFavorites()
  const navigate = useNavigate()
  const location = useLocation()
  const active = loggedIn && isFavorite(service.id)

  function handleClick(event) {
    event.preventDefault()
    event.stopPropagation()
    if (!loggedIn) {
      navigate('/cuenta', { state: { backgroundLocation: location } })
      return
    }
    toggle(service)
  }

  const label = active ? 'Quitar de favoritos' : 'Guardar en favoritos'
  return <button type="button" className={`${labeled ? 'favorite-button favorite-button--labeled' : 'save-button'}${active ? ' is-active' : ''}`} aria-pressed={active} aria-label={labeled ? undefined : label} title={label} onClick={handleClick}>
    <span aria-hidden="true">{active ? '♥' : '♡'}</span>{labeled && <span>{active ? 'Guardado' : 'Guardar'}</span>}
  </button>
}
