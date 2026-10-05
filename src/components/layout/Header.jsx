import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { isCategoryAdmin, supabase } from '../../utils/supabase'

export default function Header() {
  const location = useLocation()
  const activePath = location.state?.backgroundLocation?.pathname || location.pathname
  const isActive = (path) => activePath === path
  const [session, setSession] = useState(null)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [canManageCategories, setCanManageCategories] = useState(false)
  const [categoryAdminChecked, setCategoryAdminChecked] = useState(false)
  const profileMenuRef = useRef(null)

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

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) {
      setCanManageCategories(false)
      setCategoryAdminChecked(true)
      return
    }

    let active = true
    setCanManageCategories(false)
    setCategoryAdminChecked(false)
    isCategoryAdmin().then(({ data, error }) => {
      if (!active) return
      setCanManageCategories(!error && data === true)
      setCategoryAdminChecked(true)
    }).catch(() => {
      if (!active) return
      setCanManageCategories(false)
      setCategoryAdminChecked(true)
    })

    return () => { active = false }
  }, [session?.user?.id])

  useEffect(() => {
    setProfileMenuOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!profileMenuOpen) return

    function handlePointerDown(event) {
      if (!profileMenuRef.current?.contains(event.target)) setProfileMenuOpen(false)
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') setProfileMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [profileMenuOpen])

  const displayName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email?.split('@')[0] || 'Mi cuenta'
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

  async function handleSignOut() {
    setProfileMenuOpen(false)
    if (supabase) await supabase.auth.signOut()
  }

  return <header className="site-header">
    <div className="header-inner">
      <Link to="/" className="brand"><span className="brand-mark" aria-hidden="true">⌂</span><span className="brand-copy">oficios <i>cerca</i><small>Servicios de confianza, cerca de ti</small></span></Link>
      <nav aria-label="Navegación principal">
        <Link className={isActive('/') ? 'header-nav-active' : ''} to="/">Inicio</Link>
        <Link className={isActive('/buscar') ? 'header-nav-active' : ''} to="/buscar">Categorías</Link>
        <Link className={isActive('/prestadores') ? 'header-nav-active' : ''} to="/prestadores">Para profesionales</Link>
      </nav>
      <div className="header-actions">
        {session ? <div className="header-profile-wrap" ref={profileMenuRef} onMouseEnter={() => setProfileMenuOpen(true)} onMouseLeave={() => setProfileMenuOpen(false)}>
          <button className="header-profile" type="button" aria-haspopup="true" aria-expanded={profileMenuOpen} aria-controls="header-profile-menu" onClick={() => setProfileMenuOpen(true)}>
            <span className="header-profile-avatar" aria-hidden="true">{initials}</span>
            <span>Mi Cuenta</span>
            <span className="header-profile-chevron" aria-hidden="true" />
          </button>
          {profileMenuOpen && <section className="header-profile-menu" id="header-profile-menu" aria-label="Menú de mi cuenta">
            <div className="header-profile-identity">
              <strong>{displayName}</strong>
              <span>{session.user.email}</span>
            </div>
            <nav className="header-profile-links" aria-label="Opciones de mi cuenta">
              <Link to="/perfil" state={{ profileSection: 'profile', profileEditing: true }} onClick={() => setProfileMenuOpen(false)}>Mi perfil</Link>
              {categoryAdminChecked && canManageCategories ? <Link to="/admin/categorias" onClick={() => setProfileMenuOpen(false)}>Administrar categorías</Link> : categoryAdminChecked && <>
                <Link to="/perfil" state={{ profileSection: 'services' }} onClick={() => setProfileMenuOpen(false)}>Mis servicios</Link>
                <Link to="/perfil" state={{ profileSection: 'explore' }} onClick={() => setProfileMenuOpen(false)}>Explorar servicios</Link>
                <Link to="/mensajes" onClick={() => setProfileMenuOpen(false)}>Mensajes</Link>
              </>}
            </nav>
            <div className="header-profile-footer">
              <button type="button" onClick={handleSignOut}>Cerrar sesión</button>
            </div>
          </section>}
        </div> : <>
          <Link className="header-signin" to="/cuenta" state={{ backgroundLocation: location }}>Iniciar sesión</Link>
          <Link className="header-register" to="/registro" state={{ backgroundLocation: location }}>Regístrate</Link>
        </>}
      </div>
    </div>
  </header>
}