import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

export default function AccountPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const backgroundLocation = location.state?.backgroundLocation
  const closePath = backgroundLocation ? `${backgroundLocation.pathname}${backgroundLocation.search || ''}${backgroundLocation.hash || ''}` : '/'
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [recoveryMode, setRecoveryMode] = useState(new URLSearchParams(location.search).get('recovery') === 'true')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeType, setNoticeType] = useState('info')

  useEffect(() => {
    setRecoveryMode(new URLSearchParams(location.search).get('recovery') === 'true')
  }, [location.search])

  useEffect(() => {
    if (!authLoading && session && !recoveryMode) {
      navigate(closePath, { replace: true })
    }
  }, [authLoading, closePath, navigate, recoveryMode, session])

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY' || new URLSearchParams(window.location.search).get('recovery') === 'true') {
        setRecoveryMode(true)
      }
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') navigate(closePath)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closePath, navigate])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!supabase) return

    setBusy(true)
    setNotice('')
    let timeoutId
    try {
      const timeout = new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error('LOGIN_TIMEOUT')), 15000)
      })
      const { error } = await Promise.race([
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
        timeout,
      ])
      if (error) throw error
      setNoticeType('success')
      setNotice('Sesión iniciada correctamente.')
      setPassword('')
    } catch (error) {
      setNoticeType('error')
      setNotice(error.message === 'LOGIN_TIMEOUT'
        ? 'El inicio de sesión está tardando demasiado. Verifica tu conexión e inténtalo de nuevo.'
        : 'No se pudo iniciar sesión. Revisa tus credenciales y confirma tu correo.')
    } finally {
      window.clearTimeout(timeoutId)
      setBusy(false)
    }
  }

  async function handleGoogleAuth() {
    if (!supabase) {
      setNoticeType('error')
      setNotice('Configura Supabase para iniciar sesión con Google.')
      return
    }

    setBusy(true)
    setNotice('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/cuenta` },
      })
      if (error) throw error
    } catch (error) {
      setNoticeType('error')
      setNotice('No se pudo continuar con Google. Verifica que el proveedor esté habilitado en Supabase.')
      setBusy(false)
    }
  }

  async function handlePasswordReset() {
    if (!supabase) {
      setNoticeType('error')
      setNotice('Configura Supabase para recuperar la contraseña.')
      return
    }

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setNoticeType('error')
      setNotice('Escribe tu correo electrónico para recibir el enlace de recuperación.')
      return
    }

    setBusy(true)
    setNotice('')
    try {
      const redirectTo = `${window.location.origin}/cuenta?recovery=true`
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, { redirectTo })
      if (error) throw error
      setNoticeType('success')
      setNotice('Si el correo está registrado, recibirás un enlace para crear una nueva contraseña.')
    } catch {
      setNoticeType('error')
      setNotice('No se pudo enviar el enlace. Revisa el correo y la configuración de Supabase.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSetPassword(event) {
    event.preventDefault()
    if (!supabase) return

    if (newPassword.trim().length < 6) {
      setNoticeType('error')
      setNotice('Usa una contraseña de al menos seis caracteres.')
      return
    }

    setBusy(true)
    setNotice('')
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setNoticeType('success')
      setNotice('Contraseña actualizada correctamente. Ya puedes iniciar sesión.')
      setRecoveryMode(false)
      setNewPassword('')
      setPassword('')
      window.history.replaceState({}, '', `${window.location.pathname}`)
    } catch {
      setNoticeType('error')
      setNotice('No se pudo actualizar la contraseña. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  async function handleLogout() {
    if (!supabase) return
    await supabase.auth.signOut()
    setNotice('')
  }

  if (authLoading) return null

  return <div className="login-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) navigate(closePath) }}>
    <section className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
      <button className="login-close" type="button" aria-label="Cerrar inicio de sesión" onClick={() => navigate(closePath)}>×</button>
      {recoveryMode ? <div className="login-recovery">
        <span className="login-mark" aria-hidden="true">☰</span>
        <h1 id="login-title">Crear nueva contraseña</h1>
        <p className="login-subtitle">Elige una contraseña segura para tu cuenta.</p>
        <form className="login-form" onSubmit={handleSetPassword}>
          <label className="login-field"><span aria-hidden="true">♙</span><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={6} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Nueva contraseña" aria-label="Nueva contraseña" /><button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? '◉' : '◎'}</button></label>
          <button className="login-submit" type="submit" disabled={busy}>{busy ? 'Guardando...' : 'Guardar contraseña'}</button>
        </form>
        <button type="button" className="login-recovery-back" onClick={() => { setRecoveryMode(false); setNotice(''); setNewPassword('') }}>Volver al inicio de sesión</button>
        {notice && <p className={`account-notice account-notice--${noticeType}`} role={noticeType === 'error' ? 'alert' : 'status'}>{notice}</p>}
      </div> : session ? <div className="login-session">
        <span className="login-mark" aria-hidden="true">☰</span>
        <h1 id="login-title">Bienvenido de nuevo</h1>
        <p>Ya tienes una sesión activa.</p>
        <strong>{session.user.email}</strong>
        <Link className="login-profile-link" to="/perfil">Ver mi perfil</Link>
        <button className="login-submit" type="button" onClick={handleLogout}>Cerrar sesión</button>
      </div> : <>
        <span className="login-mark" aria-hidden="true">☰</span>
        <h1 id="login-title">Bienvenido a DaloYa</h1>
        <p className="login-subtitle">Inicia sesión para continuar</p>
        <button className="login-google" type="button" onClick={handleGoogleAuth} disabled={busy}><span aria-hidden="true">G</span>{busy ? 'Conectando...' : 'Continuar con Google'}</button>
        <div className="login-divider"><span>o con tu correo</span></div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field"><span aria-hidden="true">✉</span><input autoFocus type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Correo electrónico" aria-label="Correo electrónico" /></label>
          <label className="login-field"><span aria-hidden="true">♙</span><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Contraseña" aria-label="Contraseña" /><button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? '◉' : '◎'}</button></label>
          <div className="login-options"><label><input type="checkbox" /> Recordarme</label><button type="button" onClick={handlePasswordReset}>¿Olvidaste tu contraseña?</button></div>
          <button className="login-submit" type="submit" disabled={busy}>{busy ? 'Iniciando sesión...' : 'Iniciar sesión'}</button>
        </form>
        {notice && <p className={`account-notice account-notice--${noticeType}`} role={noticeType === 'error' ? 'alert' : 'status'}>{notice}</p>}
        <p className="login-register">¿No tienes cuenta? <Link to="/registro" state={{ backgroundLocation: { pathname: '/' } }}>Regístrate gratis</Link></p>
      </>}
    </section>
  </div>
}