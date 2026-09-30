import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

export default function AccountPage() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') navigate('/')
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [navigate])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!supabase) return

    if (!supabase) {
      setNoticeType('error')
      setNotice('Configura Supabase para iniciar sesión.')
      return
    }

    setBusy(true)
    setNotice('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      setNoticeType('success')
      setNotice('Sesión iniciada correctamente.')
      setPassword('')
    } catch {
      setNoticeType('error')
      setNotice('No se pudo iniciar sesión. Revisa tus credenciales y confirma tu correo.')
    } finally {
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

  async function handleLogout() {
    if (!supabase) return
    await supabase.auth.signOut()
    setNotice('')
  }

  if (authLoading) return null

  return <div className="login-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) navigate('/') }}>
    <section className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
      <button className="login-close" type="button" aria-label="Cerrar inicio de sesión" onClick={() => navigate('/')}>×</button>
      {session ? <div className="login-session">
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
          <div className="login-options"><label><input type="checkbox" /> Recordarme</label><button type="button" onClick={() => { setNoticeType('info'); setNotice('La recuperación de contraseña estará disponible próximamente.') }}>¿Olvidaste tu contraseña?</button></div>
          <button className="login-submit" type="submit" disabled={busy}>{busy ? 'Iniciando sesión...' : 'Iniciar sesión'}</button>
        </form>
        {notice && <p className={`account-notice account-notice--${noticeType}`} role={noticeType === 'error' ? 'alert' : 'status'}>{notice}</p>}
        <p className="login-register">¿No tienes cuenta? <Link to="/registro" state={{ backgroundLocation: { pathname: '/' } }}>Regístrate gratis</Link></p>
      </>}
    </section>
  </div>
}