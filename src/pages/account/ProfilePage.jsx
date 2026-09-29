import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '../../utils/supabase'

function getFullName(user) {
  return user?.user_metadata?.full_name || user?.user_metadata?.name || ''
}

export default function ProfilePage() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [fullName, setFullName] = useState('')
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

  return (
    <main className="account-page">
      <section className="account-intro">
        <p className="eyebrow">OFICIOS CERCA</p>
        <h1>Mi perfil.</h1>
        <p>Consulta y actualiza la información asociada a tu cuenta.</p>
        <Link to="/buscar" className="account-browse-link">Explorar servicios <span>→</span></Link>
      </section>
      <section className="account-panel">
        {authLoading ? <p>Comprobando sesión...</p> : !isSupabaseConfigured ? <p role="status">Configura Supabase para consultar tu perfil.</p> : !session ? <div className="account-session">
          <p>Inicia sesión para ver y editar tu perfil.</p>
          <Link className="account-profile-link" to="/cuenta">Iniciar sesión <span>→</span></Link>
        </div> : <>
          <form className="account-form" onSubmit={handleSaveProfile}>
            <label>Nombre completo<input autoComplete="name" maxLength={100} required value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
            <label>Correo electrónico<input type="email" value={session.user.email || ''} disabled readOnly /></label>
            <button type="submit" disabled={busy}>{busy ? 'Guardando...' : 'Guardar cambios'}</button>
          </form>
          {notice && <p className={`account-notice account-notice--${noticeType}`} role={noticeType === 'error' ? 'alert' : 'status'}>{notice}</p>}
          <div className="account-session"><button type="button" onClick={handleLogout}>Cerrar sesión</button></div>
        </>}
      </section>
    </main>
  )
}