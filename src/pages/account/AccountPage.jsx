import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

export default function AccountPage({ initialMode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [mode, setMode] = useState(initialMode)
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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

  function switchMode(nextMode) {
    setMode(nextMode)
    setNotice('')
    setPassword('')
    setConfirmPassword('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!supabase) return

    if (mode === 'signup' && password !== confirmPassword) {
      setNoticeType('error')
      setNotice('Las contraseñas no coinciden.')
      return
    }

    setBusy(true)
    setNotice('')
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${window.location.origin}/cuenta`,
          },
        })
        if (error) throw error
        setNoticeType('success')
        setNotice(data.session ? 'Cuenta creada. Ya iniciaste sesión.' : 'Cuenta creada. Revisa tu correo para confirmar la cuenta y luego inicia sesión.')
        setPassword('')
        setConfirmPassword('')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        setNoticeType('success')
        setNotice('Sesión iniciada correctamente.')
        setPassword('')
      }
    } catch (error) {
      setNoticeType('error')
      setNotice(mode === 'signup'
        ? 'No se pudo crear la cuenta. Verifica el correo y que el registro público esté habilitado en Supabase.'
        : 'No se pudo iniciar sesión. Revisa tus credenciales y confirma tu correo.')
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogleAuth() {
    if (!supabase) return

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

  return (
    <main className="account-page">
      <section className="account-intro">
        <p className="eyebrow">OFICIOS CERCA</p>
        <h1>{session ? 'Tu cuenta está lista.' : mode === 'signup' ? 'Crea tu cuenta.' : 'Qué bueno verte.'}</h1>
        <p>{session ? 'Ya puedes explorar los servicios disponibles.' : 'Encuentra servicios confiables o conecta con personas de tu comunidad.'}</p>
        <Link to="/buscar" className="account-browse-link">Explorar servicios <span>→</span></Link>
      </section>
      <section className="account-panel">
        {authLoading ? <p>Comprobando sesión...</p> : session ? <div className="account-session">
          <p className="eyebrow">SESIÓN ACTIVA</p>
          <strong>{session.user.email}</strong>
          <Link className="account-profile-link" to="/perfil">Ver y editar mi perfil <span>→</span></Link>
          <button type="button" onClick={handleLogout}>Cerrar sesión</button>
        </div> : <>
          <div className="account-tabs" role="tablist" aria-label="Acceso a la cuenta">
            <button type="button" role="tab" aria-selected="false" onClick={() => navigate('/registro', { state: { backgroundLocation: location } })}>Crear cuenta</button>
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Iniciar sesión</button>
          </div>
          <form className="account-form" onSubmit={handleSubmit}>
            {mode === 'signup' && <label>Nombre completo<input autoComplete="name" maxLength={100} required value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>}
            <label>Correo electrónico<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Contraseña<input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'signup' ? 'Mínimo 8 caracteres' : ''} /></label>
            {mode === 'signup' && <label>Confirmar contraseña<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>}
            <button type="submit" disabled={busy}>{busy ? 'Procesando...' : mode === 'signup' ? 'Crear cuenta' : 'Iniciar sesión'}</button>
          </form>
          <div className="account-divider"><span>o</span></div>
          <button className="account-google-button" type="button" onClick={handleGoogleAuth} disabled={busy}>
            <span aria-hidden="true">G</span>{mode === 'signup' ? 'Crear cuenta con Google' : 'Continuar con Google'}
          </button>
          {notice && <p className={`account-notice account-notice--${noticeType}`} role={noticeType === 'error' ? 'alert' : 'status'}>{notice}</p>}
        </>}
      </section>
    </main>
  )
}