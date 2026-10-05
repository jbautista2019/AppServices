import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getUnreadMessageNotifications, isCategoryAdmin, supabase } from '../../utils/supabase'

export default function Header() {
  const location = useLocation()
  const activePath = location.state?.backgroundLocation?.pathname || location.pathname
  const isActive = (path) => activePath === path
  const [session, setSession] = useState(null)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [canManageCategories, setCanManageCategories] = useState(false)
  const [categoryAdminChecked, setCategoryAdminChecked] = useState(false)
  const profileMenuRef = useRef(null)
  const notificationsRef = useRef(null)

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
    const userId = session?.user?.id
    if (!userId || !supabase) {
      setNotifications([])
      return
    }

    let active = true
    async function refreshNotifications() {
      const { data, error } = await getUnreadMessageNotifications(userId)
      if (active && !error) setNotifications(data || [])
    }

    refreshNotifications()
    const channel = supabase
      .channel(`message-notifications-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, refreshNotifications)
      .subscribe()
    window.addEventListener('focus', refreshNotifications)

    return () => {
      active = false
      window.removeEventListener('focus', refreshNotifications)
      supabase.removeChannel(channel)
    }
  }, [session?.user?.id])

  useEffect(() => {
    setProfileMenuOpen(false)
    setNotificationsOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!profileMenuOpen && !notificationsOpen) return

    function handlePointerDown(event) {
      if (!profileMenuRef.current?.contains(event.target)) setProfileMenuOpen(false)
      if (!notificationsRef.current?.contains(event.target)) setNotificationsOpen(false)
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false)
        setNotificationsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [notificationsOpen, profileMenuOpen])

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
        {session && <div className="header-notifications-wrap" ref={notificationsRef}>
          <button className="header-notifications-button" type="button" aria-label={notifications.length ? `Notificaciones, ${notifications.length} mensajes sin leer` : 'Notificaciones'} aria-haspopup="true" aria-expanded={notificationsOpen} aria-controls="header-notifications-menu" onClick={() => { setNotificationsOpen((open) => !open); setProfileMenuOpen(false) }}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>
            {notifications.length > 0 && <span className="header-notifications-badge">{notifications.length > 99 ? '99+' : notifications.length}</span>}
          </button>
          {notificationsOpen && <section className="header-notifications-menu" id="header-notifications-menu" aria-label="Notificaciones de mensajes">
            <div className="header-notifications-heading"><strong>Notificaciones</strong><span>{notifications.length} sin leer</span></div>
            {notifications.length ? <div className="header-notifications-list">{notifications.map((notification) => {
              const conversation = notification.conversations
              const senderName = String(conversation.client_id) === String(session.user.id)
                ? conversation.provider_name || 'Profesional'
                : conversation.client_name || 'Cliente'
              return <Link className="header-notification-item" key={notification.id} to={`/mensajes?conversation=${encodeURIComponent(notification.conversation_id)}`} onClick={() => setNotificationsOpen(false)}>
                <span className="header-notification-dot" aria-hidden="true" />
                <span><strong>{senderName}</strong><small>{conversation.service_title}</small><span>{notification.content}</span></span>
              </Link>
            })}</div> : <p className="header-notifications-empty">No tienes mensajes nuevos.</p>}
            <Link className="header-notifications-all" to="/mensajes" onClick={() => setNotificationsOpen(false)}>Ver mensajes</Link>
          </section>}
        </div>}
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