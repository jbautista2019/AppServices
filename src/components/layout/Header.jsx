import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

export default function Header() {
  const location = useLocation()
  const activePath = location.state?.backgroundLocation?.pathname || location.pathname
  const isActive = (path) => activePath === path
  const [session, setSession] = useState(null)

  useEffect(() => {
    if (!supabase) {
      setSession(null)
      return
    }

    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return <header className="site-header">
    <div className="header-inner">
      <Link to="/" className="brand"><span className="brand-mark" aria-hidden="true">⌂</span><span className="brand-copy">oficios <i>cerca</i><small>Servicios de confianza, cerca de ti</small></span></Link>
      <nav aria-label="Navegación principal">
        <Link className={isActive('/') ? 'header-nav-active' : ''} to="/">Inicio</Link>
        <Link className={isActive('/buscar') ? 'header-nav-active' : ''} to="/buscar">Categorías</Link>
        <Link className={isActive('/prestadores') ? 'header-nav-active' : ''} to="/prestadores">Para profesionales</Link>
      </nav>
      <div className="header-actions">
        {session ? <Link className="header-profile" to="/perfil" state={{ backgroundLocation: location }} aria-label="Ir al perfil de usuario">
          <span aria-hidden="true">👤</span>
          <span>Perfil</span>
        </Link> : <>
          <Link className="header-signin" to="/cuenta" state={{ backgroundLocation: location }}>Iniciar sesión</Link>
          <Link className="header-register" to="/registro" state={{ backgroundLocation: location }}>Regístrate</Link>
        </>}
      </div>
    </div>
  </header>
}