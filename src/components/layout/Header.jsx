import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getPendingReportNotifications, getUnreadMessageNotifications, getUnreadPlatformNotifications, markPlatformNotificationsRead, isCategoryAdmin, REPORT_REASONS, REPORTS_CHANGED_EVENT, supabase } from '../../utils/supabase'

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchText, setSearchText] = useState(() => (location.pathname === '/buscar' ? new URLSearchParams(location.search).get('q') || '' : ''))
  const activePath = location.state?.backgroundLocation?.pathname || location.pathname
  const isActive = (path) => activePath === path
  const [session, setSession] = useState(null)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [reportNotifications, setReportNotifications] = useState([])
  const [platformNotifications, setPlatformNotifications] = useState([])
  const totalNotifications = notifications.length + reportNotifications.length + platformNotifications.length
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
    const userId = session?.user?.id
    if (!userId || !supabase) {
      setPlatformNotifications([])
      return
    }

    let active = true
    async function refreshPlatformNotifications() {
      const { data, error } = await getUnreadPlatformNotifications(userId)
      if (active && !error) setPlatformNotifications(data || [])
    }

    refreshPlatformNotifications()
    const channel = supabase
      .channel(`platform-notifications-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${userId}` }, refreshPlatformNotifications)
      .subscribe()
    window.addEventListener('focus', refreshPlatformNotifications)

    return () => {
      active = false
      window.removeEventListener('focus', refreshPlatformNotifications)
      supabase.removeChannel(channel)
    }
  }, [session?.user?.id])

  async function openPlatformNotification(notification) {
    setNotificationsOpen(false)
    setPlatformNotifications((current) => current.filter((item) => item.id !== notification.id))
    await markPlatformNotificationsRead([notification.id])
  }

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId || !supabase || !canManageCategories) {
      setReportNotifications([])
      return
    }

    let active = true
    async function refreshReports() {
      const { data, error } = await getPendingReportNotifications()
      if (active && !error) setReportNotifications(data || [])
    }

    refreshReports()
    const channel = supabase
      .channel(`report-notifications-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_reports' }, refreshReports)
      .subscribe()
    window.addEventListener('focus', refreshReports)
    window.addEventListener(REPORTS_CHANGED_EVENT, refreshReports)

    return () => {
      active = false
      window.removeEventListener('focus', refreshReports)
      window.removeEventListener(REPORTS_CHANGED_EVENT, refreshReports)
      supabase.removeChannel(channel)
    }
  }, [session?.user?.id, canManageCategories])

  useEffect(() => {
    if (location.pathname === '/buscar') setSearchText(new URLSearchParams(location.search).get('q') || '')
  }, [location.pathname, location.search])

  function handleSearch(event) {
    event.preventDefault()
    const term = searchText.trim()
    navigate(term ? `/buscar?q=${encodeURIComponent(term)}` : '/buscar')
  }

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
      <form className="header-search" role="search" onSubmit={handleSearch}>
        <input type="search" aria-label="Buscar servicios" placeholder="Busca gasfíter, electricista, manicure..." value={searchText} onChange={(event) => setSearchText(event.target.value)} />
        <button type="submit" aria-label="Buscar">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        </button>
      </form>
      <nav aria-label="Navegación principal">
        <Link className={isActive('/') ? 'header-nav-active' : ''} to="/">Inicio</Link>
        <Link className={isActive('/buscar') ? 'header-nav-active' : ''} to="/buscar">Categorías</Link>
      </nav>
      <div className="header-actions">
        {session && <div className="header-notifications-wrap" ref={notificationsRef}>
          <button className="header-notifications-button" type="button" aria-label={totalNotifications ? `Notificaciones, ${totalNotifications} sin leer` : 'Notificaciones'} aria-haspopup="true" aria-expanded={notificationsOpen} aria-controls="header-notifications-menu" onClick={() => { setNotificationsOpen((open) => !open); setProfileMenuOpen(false) }}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>
            {totalNotifications > 0 && <span className="header-notifications-badge">{totalNotifications > 99 ? '99+' : totalNotifications}</span>}
          </button>
          {notificationsOpen && <section className="header-notifications-menu" id="header-notifications-menu" aria-label="Notificaciones de mensajes">
            <div className="header-notifications-heading"><strong>Notificaciones</strong><span>{totalNotifications} sin leer</span></div>
            {platformNotifications.length > 0 && <div className="header-notifications-list">{platformNotifications.map((notification) => <Link className="header-notification-item" key={notification.id} to={notification.link || `${location.pathname}${location.search}`} onClick={() => openPlatformNotification(notification)}>
              <span className="header-notification-dot header-notification-dot--alert" aria-hidden="true" />
              <span><strong>{notification.title}</strong>{notification.body && <span>{notification.body}</span>}</span>
            </Link>)}</div>}
            {reportNotifications.length > 0 && <div className="header-notifications-list">
              <Link className="header-notification-item" to="/admin/reportes" onClick={() => setNotificationsOpen(false)}>
                <span className="header-notification-dot header-notification-dot--alert" aria-hidden="true" />
                <span><strong>{reportNotifications.length === 1 ? '1 publicación reportada' : `${reportNotifications.length} publicaciones reportadas`}</strong>{reportNotifications.slice(0, 3).map((report) => <small key={report.id}>{report.services?.title || 'Publicación'} · {REPORT_REASONS.find((item) => item.value === report.reason)?.label || report.reason}</small>)}<span>Pendientes de revisión</span></span>
              </Link>
            </div>}
            {notifications.length ?<div className="header-notifications-list">{notifications.map((notification) => {
              const conversation = notification.conversations
              const senderName = String(conversation.client_id) === String(session.user.id)
                ? conversation.provider_name || 'Profesional'
                : conversation.client_name || 'Cliente'
              return <Link className="header-notification-item" key={notification.id} to={`/mensajes?conversation=${encodeURIComponent(notification.conversation_id)}`} onClick={() => setNotificationsOpen(false)}>
                <span className="header-notification-dot" aria-hidden="true" />
                <span><strong>{senderName}</strong><small>{conversation.service_title}</small><span>{notification.content}</span></span>
              </Link>
            })}</div> : !reportNotifications.length && !platformNotifications.length && <p className="header-notifications-empty">No tienes mensajes nuevos.</p>}
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
              {categoryAdminChecked && canManageCategories ? <>
                <Link to="/admin/categorias" onClick={() => setProfileMenuOpen(false)}>Administrar categorías</Link>
                <Link to="/admin/reportes" onClick={() => setProfileMenuOpen(false)}>Reportes de publicaciones</Link>
              </> : categoryAdminChecked && <>
                <Link to="/mis-servicios" onClick={() => setProfileMenuOpen(false)}>Mis servicios</Link>
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