import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Stars from '../../components/reviews/Stars'
import { changePassword, getProviderRatingSummary, isCategoryAdmin, MIN_PASSWORD_LENGTH, isSupabaseConfigured, supabase } from '../../utils/supabase'

function getFullName(user) {
  return user?.user_metadata?.full_name || user?.user_metadata?.name || ''
}

export default function ProfilePage() {
  const location = useLocation()
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [fullName, setFullName] = useState('')
  const [editingProfile, setEditingProfile] = useState(location.state?.profileEditing === true)
  const [rating, setRating] = useState(null)
  const [ratingError, setRatingError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeType, setNoticeType] = useState('info')
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordNotice, setPasswordNotice] = useState({ type: 'info', text: '' })
  const userId = session?.user?.id
  // Las cuentas creadas solo con Google no tienen contraseña actual que verificar.
  const hasPassword = Boolean(session?.user?.identities?.some((identity) => identity.provider === 'email'))

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
  }, [userId, session?.user?.user_metadata?.full_name, session?.user?.user_metadata?.name])

  useEffect(() => {
    if (location.state?.profileEditing === true) setEditingProfile(true)
  }, [location.key, location.state?.profileEditing])

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false)
      setRating(null)
      return
    }

    let cancelled = false
    isCategoryAdmin().then(({ data, error }) => {
      if (!cancelled) setIsAdmin(!error && data === true)
    }).catch(() => {
      if (!cancelled) setIsAdmin(false)
    })
    getProviderRatingSummary(userId).then(({ data, error }) => {
      if (cancelled) return
      setRating(data)
      setRatingError(error ? 'No se pudieron cargar tus valoraciones. ¿Ejecutaste supabase/reviews.sql?' : '')
    }).catch(() => {})

    return () => { cancelled = true }
  }, [userId])

  useEffect(() => {
    if (!supabase || !userId) return

    let cancelled = false
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (cancelled || error || user?.id !== userId) return
      setSession((current) => current?.user?.id === user.id ? { ...current, user } : current)
    })

    return () => { cancelled = true }
  }, [userId])

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

  function closePasswordForm() {
    setPasswordOpen(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  async function handleChangePassword(event) {
    event.preventDefault()
    if (newPassword !== confirmPassword) {
      setPasswordNotice({ type: 'error', text: 'La confirmación no coincide con la nueva contraseña.' })
      return
    }

    setPasswordBusy(true)
    setPasswordNotice({ type: 'info', text: '' })
    const { error } = await changePassword({
      email: session.user.email,
      currentPassword: hasPassword ? currentPassword : null,
      newPassword,
    })
    setPasswordBusy(false)

    if (error) {
      setPasswordNotice({ type: 'error', text: error.message })
      return
    }
    closePasswordForm()
    setPasswordNotice({ type: 'success', text: 'Tu contraseña se actualizó correctamente.' })
  }

  async function handleLogout() {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  const displayName = getFullName(session?.user) || session?.user?.email?.split('@')[0] || 'Mi cuenta'
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const maxBucket = rating ? Math.max(...Object.values(rating.distribution), 1) : 1

  return (
    <main className="account-dashboard account-dashboard--compact">
      <section className="account-dashboard-content">
        {authLoading ? <p className="account-dashboard-message">Comprobando sesión...</p> : !isSupabaseConfigured ? <p className="account-dashboard-message" role="status">Configura Supabase para consultar tu perfil.</p> : !session ? <div className="account-dashboard-message">
          <p>Inicia sesión para ver y editar tu perfil.</p>
          <Link className="account-profile-link" to="/cuenta" state={{ backgroundLocation: location }}>Iniciar sesión <span>→</span></Link>
        </div> : <div className="profile-card">
          <header className="profile-card-header">
            <div className="account-avatar" aria-hidden="true">{initials}</div>
            <div className="profile-card-identity">
              <h1>{displayName}{isAdmin && <span className="profile-badge">Administrador</span>}</h1>
              <p>{session.user.email}</p>
            </div>
            {!editingProfile && <button className="profile-edit-button" type="button" onClick={() => { setNotice(''); setEditingProfile(true) }}>Editar perfil</button>}
          </header>

          <section className="profile-rating" aria-label="Valoración">
            {rating?.count ? <>
              <div className="profile-rating-score">
                <strong>{rating.average.toFixed(1)}</strong>
                <Stars value={rating.average} size={20} />
                <small>{rating.count} {rating.count === 1 ? 'valoración' : 'valoraciones'}</small>
              </div>
              <ul className="profile-rating-bars">{[5, 4, 3, 2, 1].map((star) => <li key={star}>
                <span>{star} ★</span>
                <div><i style={{ width: `${(rating.distribution[star] / maxBucket) * 100}%` }} /></div>
                <small>{rating.distribution[star]}</small>
              </li>)}</ul>
            </> : <p className="profile-rating-empty"><Stars value={0} size={20} /> {ratingError || 'Aún no tienes valoraciones. Pide a tus clientes que valoren tu servicio desde el chat.'}</p>}
          </section>

          {editingProfile && <form className="account-form profile-form" onSubmit={handleSaveProfile}>
            <label>Nombre completo<input autoComplete="name" maxLength={100} required value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
            <label>Correo electrónico<input type="email" value={session.user.email || ''} disabled readOnly /></label>
            <div className="account-inline-actions">
              <button type="submit" disabled={busy}>{busy ? 'Guardando...' : 'Guardar cambios'}</button>
              <button type="button" onClick={() => { setEditingProfile(false); setFullName(getFullName(session.user)); setNotice('') }}>Cancelar</button>
            </div>
          </form>}
          {notice && <p className={`account-notice account-notice--${noticeType}`} role={noticeType === 'error' ? 'alert' : 'status'}>{notice}</p>}

          <section className="profile-security" aria-label="Seguridad">
            <div className="profile-security-heading">
              <div><h2>Contraseña</h2><p>{hasPassword ? 'Cambia la contraseña con la que inicias sesión.' : 'Tu cuenta usa Google. Puedes crear una contraseña para entrar también con tu correo.'}</p></div>
              {!passwordOpen && <button className="profile-edit-button" type="button" onClick={() => { setPasswordNotice({ type: 'info', text: '' }); setPasswordOpen(true) }}>{hasPassword ? 'Cambiar contraseña' : 'Crear contraseña'}</button>}
            </div>
            {passwordOpen && <form className="account-form profile-form" onSubmit={handleChangePassword}>
              {hasPassword && <label>Contraseña actual<input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>}
              <label>Nueva contraseña<input type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`} /></label>
              <label>Confirmar nueva contraseña<input type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
              <div className="account-inline-actions">
                <button type="submit" disabled={passwordBusy}>{passwordBusy ? 'Guardando...' : 'Guardar contraseña'}</button>
                <button type="button" onClick={closePasswordForm}>Cancelar</button>
              </div>
            </form>}
            {passwordNotice.text && <p className={`account-notice account-notice--${passwordNotice.type}`} role={passwordNotice.type === 'error' ? 'alert' : 'status'}>{passwordNotice.text}</p>}
          </section>

          <footer className="profile-card-footer">
            {isAdmin && <Link to="/admin/categorias">Administrar categorías <span>→</span></Link>}
            <button type="button" onClick={handleLogout}>Cerrar sesión</button>
          </footer>
        </div>}
      </section>
    </main>
  )
}
