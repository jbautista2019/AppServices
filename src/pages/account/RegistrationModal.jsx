import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

export default function RegistrationModal({ onClose }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeType, setNoticeType] = useState('info')

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!supabase) {
      setNoticeType('error')
      setNotice('Configura Supabase para crear una cuenta.')
      return
    }

    if (password !== confirmPassword) {
      setNoticeType('error')
      setNotice('Las contraseñas no coinciden.')
      return
    }

    setBusy(true)
    setNotice('')
    try {
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
      setNotice(data.session
        ? 'Cuenta creada. Ya puedes explorar los servicios.'
        : 'Cuenta creada. Revisa tu correo para confirmar tu cuenta.')
      setPassword('')
      setConfirmPassword('')
    } catch {
      setNoticeType('error')
      setNotice('No se pudo crear la cuenta. Revisa tus datos y la configuración de registro en Supabase.')
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogleSignup() {
    if (!supabase) {
      setNoticeType('error')
      setNotice('Configura Supabase para registrarte con Google.')
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
    } catch {
      setNoticeType('error')
      setNotice('No se pudo continuar con Google. Verifica que el proveedor esté habilitado en Supabase.')
      setBusy(false)
    }
  }

  return <div className="registration-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="registration-modal" role="dialog" aria-modal="true" aria-labelledby="registration-title">
      <button className="registration-close" type="button" aria-label="Cerrar registro" onClick={onClose}>×</button>
      <span className="registration-mark" aria-hidden="true">⌂</span>
      <h1 id="registration-title">Crea tu cuenta</h1>
      <p className="registration-subtitle">Es gratis y te tomará menos de 1 minuto</p>

      <button className="registration-google" type="button" onClick={handleGoogleSignup} disabled={busy}>
        <span aria-hidden="true">G</span>{busy ? 'Conectando...' : 'Registrarse con Google'}
      </button>

      <div className="registration-divider"><span>o con tu correo</span></div>

      <form className="account-form registration-form" onSubmit={handleSubmit}>
        <label className="registration-field"><span aria-hidden="true">♙</span><input autoFocus autoComplete="name" maxLength={100} required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nombre completo" aria-label="Nombre completo" /></label>
        <label className="registration-field"><span aria-hidden="true">✉</span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Correo electrónico" aria-label="Correo electrónico" /></label>
        <label className="registration-field"><span aria-hidden="true">♙</span><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Contraseña (mínimo 8 caracteres)" aria-label="Contraseña" /><button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? '◉' : '◎'}</button></label>
        <label className="registration-field"><span aria-hidden="true">♙</span><input type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirmar contraseña" aria-label="Confirmar contraseña" /><button type="button" aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowConfirmPassword((visible) => !visible)}>{showConfirmPassword ? '◉' : '◎'}</button></label>
        <button className="registration-submit" type="submit" disabled={busy}>{busy ? 'Creando cuenta...' : 'Crear cuenta gratis'}</button>
      </form>

      {notice && <p className={`account-notice account-notice--${noticeType}`} role={noticeType === 'error' ? 'alert' : 'status'}>{notice}</p>}
      <p className="registration-login">¿Ya tienes cuenta? <Link to="/cuenta">Inicia sesión</Link></p>
    </section>
  </div>
}