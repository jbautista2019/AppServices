import { Link, useLocation } from 'react-router-dom'

export default function Header() {
  const location = useLocation()

  return <header className="site-header">
    <div className="header-inner">
      <Link to="/" className="brand"><span className="brand-mark" aria-hidden="true">⌂</span><span className="brand-copy">oficios <i>cerca</i><small>Servicios de confianza, cerca de ti</small></span></Link>
      <nav aria-label="Navegación principal">
        <Link className="header-nav-active" to="/">Inicio</Link>
        <Link to="/buscar">Categorías</Link>
        <Link to="/prestadores">Para profesionales</Link>
      </nav>
      <div className="header-actions">
        <Link className="header-location" to="/buscar?location=Santiago"><span aria-hidden="true">⌖</span> Santiago <span aria-hidden="true">⌄</span></Link>
        <Link className="header-signin" to="/cuenta">Iniciar sesión</Link>
        <Link className="header-register" to="/registro" state={{ backgroundLocation: location }}>Regístrate</Link>
      </div>
    </div>
  </header>
}