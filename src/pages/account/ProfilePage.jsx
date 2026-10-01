import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '../../utils/supabase'
import MyServicesPage from './MyServicesPage'
import SearchPage from '../search/SearchPage'

function getFullName(user) {
  return user?.user_metadata?.full_name || user?.user_metadata?.name || ''
}

export default function ProfilePage({ services, categories, loading, loadError }) {
  const location = useLocation()
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [fullName, setFullName] = useState('')
  const [activeSection, setActiveSection] = useState(location.state?.profileSection === 'services' ? 'services' : 'profile')
  const [editingProfile, setEditingProfile] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeType, setNoticeType] = useState('info')

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    setFullName(getFullName(session?.user))
  }, [session?.user?.id, session?.user?.user_metadata?.full_name, session?.user?.user_metadata?.name])

  useEffect(() => {
    if (!supabase || !session?.user?.id) return

    let cancelled = false
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (cancelled || error || user?.id !== session.user.id) return
      setSession((current) => current?.user?.id === user.id ? { ...current, user } : current)
    })

    return () => { cancelled = true }
  }, [session?.user?.id])

  async function handleSaveProfile(event) {
    event.preventDefault()
    if (!supabase || !session) return

    const name = fullName.trim()
    if (!name) {
      setNoticeType('error')
      setNotice('Escribe tu nombre para guardar el perfil.')
      return
    }

    setBusy(true)
    setNotice('')
    try {
      const { data, error } = await supabase.auth.updateUser({ data: { full_name: name } })
      if (error) throw error

      const { data: latestData, error: refreshError } = await supabase.auth.getUser()
      if (refreshError) throw refreshError

      const updatedUser = latestData.user?.id === session.user.id ? latestData.user : data.user
      const savedName = getFullName(updatedUser)
      if (!updatedUser || savedName !== name) throw new Error('Profile update was not confirmed')

      setSession((current) => current?.user?.id === updatedUser.id ? { ...current, user: updatedUser } : current)
      setFullName(savedName)
      setEditingProfile(false)
      setNoticeType('success')
      setNotice('Tu perfil se actualizó correctamente.')
    } catch {
      setNoticeType('error')
      setNotice('No se pudo actualizar tu perfil. Inténtalo nuevamente.')
    } finally {
      setBusy(false)
    }
  }

  async function handleLogout() {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  const displayName = fullName || session?.user?.email?.split('@')[0] || 'Mi cuenta'
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

  return (
    <main className="account-dashboard">
      <aside className="account-sidebar">
        <div className="account-sidebar-heading"><span aria-hidden="true">☰</span><strong>Mi cuenta</strong></div>
        <nav className="account-sidebar-nav" aria-label="Navegación de cuenta">
          <button className={activeSection === 'profile' ? 'active' : ''} type="button" onClick={() => setActiveSection('profile')}><span aria-hidden="true">◉</span> Mi perfil</button>
          <button className={activeSection === 'services' ? 'active' : ''} type="button" onClick={() => setActiveSection('services')}><span aria-hidden="true">▤</span> Mis servicios</button>
          <button className={activeSection === 'explore' ? 'active' : ''} type="button" onClick={() => setActiveSection('explore')}><span aria-hidden="true">⌕</span> Explorar servicios</button>
        </nav>
        {session && <button className="account-sidebar-logout" type="button" onClick={handleLogout}>Cerrar sesión</button>}
      </aside>

      <section className="account-dashboard-content">
        {authLoading ? <p className="account-dashboard-message">Comprobando sesión...</p> : !isSupabaseConfigured ? <p className="account-dashboard-message" role="status">Configura Supabase para consultar tu perfil.</p> : !session ? <div className="account-dashboard-message">
          <p>Inicia sesión para ver y editar tu perfil.</p>
          <Link className="account-profile-link" to="/cuenta">Iniciar sesión <span>→</span></Link>
        </div> : <>
          <header className="account-user-summary">
            <div className="account-avatar" aria-hidden="true">{initials}</div>
            <div><h1>{displayName}</h1><p>{session.user.email}</p></div>
          </header>

          {activeSection === 'profile' ? <div className="account-module-grid">
            <article className="account-module-card">
              <span className="account-module-icon" aria-hidden="true">◉</span>
              <h2>Información de tu perfil</h2>
              <p>Datos personales y de tu cuenta.</p>
              {!editingProfile ? <button className="account-module-action" type="button" onClick={() => { setNotice(''); setEditingProfile(true) }}>Editar información <span>→</span></button> : <form className="account-form account-inline-form" onSubmit={handleSaveProfile}>
                <label>Nombre completo<input autoComplete="name" maxLength={100} required value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
                <label>Correo electrónico<input type="email" value={session.user.email || ''} disabled readOnly /></label>
                {notice && <p className={`account-notice account-notice--${noticeType}`} role={noticeType === 'error' ? 'alert' : 'status'}>{notice}</p>}
                <div className="account-inline-actions">
                  <button type="submit" disabled={busy}>{busy ? 'Guardando...' : 'Guardar cambios'}</button>
                  <button type="button" onClick={() => { setEditingProfile(false); setFullName(getFullName(session.user)); setNotice('') }}>Cancelar</button>
                </div>
              </form>}
            </article>

            <button className="account-module-card" type="button" onClick={() => setActiveSection('services')}>
              <span className="account-module-icon" aria-hidden="true">▤</span>
              <h2>Mis servicios</h2>
              <p>Administra y edita tus publicaciones.</p>
              <span className="account-module-action">Ver servicios <span>→</span></span>
            </button>

            <button className="account-module-card" type="button" onClick={() => setActiveSection('explore')}>
              <span className="account-module-icon" aria-hidden="true">⌕</span>
              <h2>Explorar servicios</h2>
              <p>Encuentra oficios y servicios cerca de ti.</p>
              <span className="account-module-action">Ir a buscar <span>→</span></span>
            </button>
          </div> : activeSection === 'services' ? <MyServicesPage userId={session.user.id} /> : <SearchPage embedded services={services} categories={categories} loading={loading} loadError={loadError} />}
        </>}
      </section>
    </main>
  )
}