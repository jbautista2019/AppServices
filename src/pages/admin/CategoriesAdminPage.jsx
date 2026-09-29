import { useEffect, useState } from 'react'
import { createCategory, deleteCategory, getCategories, isCategoryAdmin, isSupabaseConfigured, supabase, updateCategory } from '../../utils/supabase'

export default function CategoriesAdminPage() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [adminLoading, setAdminLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [categories, setCategories] = useState([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [recoveryMode, setRecoveryMode] = useState(new URLSearchParams(window.location.search).get('recovery') === 'true')
  const [draftName, setDraftName] = useState('')
  const [draftImageUrl, setDraftImageUrl] = useState('')
  const [editingName, setEditingName] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeType, setNoticeType] = useState('info')

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id

  useEffect(() => {
    if (!supabase || !userId) {
      setIsAdmin(false)
      setCategories([])
      setAdminLoading(false)
      return
    }

    let cancelled = false
    setAdminLoading(true)

    async function loadAdminCategories() {
      const { data: authorized, error: roleError } = await isCategoryAdmin()
      if (cancelled) return
      if (roleError) {
        setNotice('No se pudo verificar el permiso. Ejecuta primero el schema.sql actualizado en Supabase.')
        setIsAdmin(false)
        setAdminLoading(false)
        return
      }

      setIsAdmin(authorized === true)
      if (!authorized) {
        setAdminLoading(false)
        return
      }

      const { data, error } = await getCategories()
      if (cancelled) return
      if (error) setNotice('No se pudieron cargar las categorías.')
      else setCategories(data || [])
      setAdminLoading(false)
    }

    loadAdminCategories().catch(() => {
      if (cancelled) return
      setNotice('No se pudo conectar con Supabase.')
      setAdminLoading(false)
    })

    return () => { cancelled = true }
  }, [userId])

  async function handleLogin(event) {
    event.preventDefault()
    if (!supabase) return

    setBusy(true)
    setNotice('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setNotice('No se pudo iniciar sesión. Revisa tus credenciales.')
    setBusy(false)
  }

  async function handlePasswordReset() {
    if (!supabase || !email.trim()) return

    setBusy(true)
    setNotice('')
    const redirectTo = `${window.location.origin}/admin/categorias?recovery=true`
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    setNotice(error ? 'No se pudo enviar el enlace. Revisa la configuración de correo y URL de Supabase.' : 'Si el correo está registrado, recibirás un enlace para crear una contraseña.')
    setBusy(false)
  }

  async function handleSetPassword(event) {
    event.preventDefault()
    if (!supabase) return

    setBusy(true)
    setNotice('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setNotice('No se pudo actualizar la contraseña. Usa una contraseña de al menos seis caracteres.')
      setBusy(false)
      return
    }

    setRecoveryMode(false)
    setNewPassword('')
    setPassword('')
    window.history.replaceState({}, '', '/admin/categorias')
    setNotice('Contraseña actualizada. Tu cuenta ya puede iniciar sesión.')
    setBusy(false)
  }

  async function handleSaveCategory(event) {
    event.preventDefault()
    const name = draftName.trim()
    if (!name) {
      setNoticeType('error')
      setNotice('Escribe un nombre para la categoría.')
      return
    }

    const normalizedName = name.toLocaleLowerCase('es-CL')
    const duplicate = categories.some((category) => category.name !== editingName && category.name.trim().toLocaleLowerCase('es-CL') === normalizedName)
    if (duplicate) {
      setNoticeType('error')
      setNotice('Ya existe una categoría con ese nombre.')
      return
    }

    setBusy(true)
    setNotice('')
    const imageUrl = draftImageUrl.trim()
    const { error } = editingName
      ? await updateCategory(editingName, name, imageUrl)
      : await createCategory(name, imageUrl)

    if (error) {
      setNoticeType('error')
      setNotice(error.code === '23505' ? 'Ya existe una categoría con ese nombre.' : 'No se pudo guardar la categoría.')
      setBusy(false)
      return
    }

    const { data, error: loadError } = await getCategories()
    if (loadError) {
      setNoticeType('error')
      setNotice('La categoría se guardó, pero no se pudo actualizar la lista.')
    } else {
      setCategories(data || [])
      setNoticeType('success')
      setNotice(editingName ? 'Categoría actualizada correctamente.' : 'Categoría creada correctamente.')
    }
    setDraftName('')
    setDraftImageUrl('')
    setEditingName(null)
    setBusy(false)
  }

  async function handleDeleteCategory(name) {
    if (!window.confirm(`¿Eliminar la categoría "${name}"?`)) return

    setBusy(true)
    setNotice('')
    const { error } = await deleteCategory(name)
    if (error) {
      setNoticeType('error')
      setNotice(error.code === '23503' ? 'No puedes eliminar una categoría que tiene servicios publicados.' : 'No se pudo eliminar la categoría.')
      setBusy(false)
      return
    }

    setCategories((current) => current.filter((category) => category.name !== name))
    setNoticeType('success')
    setNotice('Categoría eliminada correctamente.')
    setBusy(false)
  }

  async function handleLogout() {
    if (!supabase) return
    await supabase.auth.signOut()
    setNotice('')
  }

  return (
    <main className="category-admin-page">
      <header className="category-admin-heading">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN</p>
          <h1>Administrar categorías</h1>
          <p>Gestiona las categorías disponibles para las publicaciones.</p>
        </div>
        {session && <button type="button" onClick={handleLogout}>Cerrar sesión</button>}
      </header>

      {!isSupabaseConfigured && <p className="category-admin-notice">Configura Supabase antes de administrar categorías.</p>}
      {isSupabaseConfigured && authLoading && <p className="category-admin-notice">Comprobando sesión...</p>}
      {isSupabaseConfigured && !authLoading && recoveryMode && session && <form className="category-admin-login" onSubmit={handleSetPassword}>
        <label>Nueva contraseña<input type="password" autoComplete="new-password" minLength={6} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
        <button type="submit" disabled={busy}>{busy ? 'Guardando...' : 'Guardar contraseña'}</button>
      </form>}
      {isSupabaseConfigured && !authLoading && !session && !recoveryMode && <form className="category-admin-login" onSubmit={handleLogin}>
        <label>Correo electrónico<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button type="submit" disabled={busy}>{busy ? 'Ingresando...' : 'Iniciar sesión'}</button>
        <button type="button" className="category-admin-reset" disabled={busy || !email.trim()} onClick={handlePasswordReset}>Enviar enlace para crear contraseña</button>
      </form>}
      {isSupabaseConfigured && !authLoading && recoveryMode && !session && <p className="category-admin-notice">Validando el enlace de recuperación...</p>}
      {isSupabaseConfigured && session && adminLoading && <p className="category-admin-notice">Verificando permisos...</p>}
      {isSupabaseConfigured && session && !adminLoading && !isAdmin && <p className="category-admin-notice">Esta cuenta no tiene permisos para administrar categorías.</p>}
      {isSupabaseConfigured && session && isAdmin && !adminLoading && <section className="category-admin-panel">
        <h2>{editingName ? 'Editar categoría' : 'Nueva categoría'}</h2>
        <form className="category-admin-form" onSubmit={handleSaveCategory}>
          <input aria-label="Nombre de categoría" maxLength={60} required value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Nombre de categoría" />
          <input aria-label="URL de imagen" type="url" value={draftImageUrl} onChange={(event) => setDraftImageUrl(event.target.value)} placeholder="https://... imagen de categoría" />
          <button type="submit" disabled={busy}>{editingName ? 'Guardar cambios' : 'Crear categoría'}</button>
          {editingName && <button type="button" onClick={() => { setEditingName(null); setDraftName(''); setDraftImageUrl('') }}>Cancelar</button>}
        </form>
        {draftImageUrl && <img className="category-admin-image-preview" src={draftImageUrl} alt="Vista previa de la categoría" />}
        {categories.length ? <ul className="category-admin-list">{categories.map((category) => <li className="category-admin-row" key={category.name}>
          <div className="category-admin-identity">{category.image_url ? <img className="category-admin-thumbnail" src={category.image_url} alt="" /> : <span className="category-admin-thumbnail category-admin-thumbnail--empty" aria-hidden="true">✦</span>}<strong>{category.name}</strong></div>
          <div className="category-admin-actions">
            <button type="button" disabled={busy} onClick={() => { setEditingName(category.name); setDraftName(category.name); setDraftImageUrl(category.image_url || '') }}>Editar</button>
            <button type="button" disabled={busy} onClick={() => handleDeleteCategory(category.name)}>Eliminar</button>
          </div>
        </li>)}</ul> : <p className="category-admin-notice">Todavía no hay categorías.</p>}
      </section>}
      {notice && <div className={`category-admin-toast category-admin-toast--${noticeType}`} role={noticeType === 'error' ? 'alert' : 'status'}>
        <span className="category-admin-toast-icon" aria-hidden="true">{noticeType === 'success' ? '✓' : '!'}</span>
        <p>{notice}</p>
        <button type="button" aria-label="Cerrar aviso" onClick={() => setNotice('')}>×</button>
      </div>}
    </main>
  )
}