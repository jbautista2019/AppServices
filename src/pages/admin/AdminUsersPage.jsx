import { useEffect, useMemo, useState } from 'react'
import { isCategoryAdmin, isSupabaseConfigured, manageUsers, supabase } from '../../lib/supabase'

export default function AdminUsersPage() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [adminLoading, setAdminLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [editingUserId, setEditingUserId] = useState(null)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
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

  const userId = session?.user?.id

  useEffect(() => {
    if (!userId) {
      setAdminLoading(false)
      setIsAdmin(false)
      setUsers([])
      return
    }

    let cancelled = false
    setAdminLoading(true)

    async function loadUsers() {
      const { data: authorized, error: roleError } = await isCategoryAdmin()
      if (cancelled) return
      if (roleError || !authorized) {
        setIsAdmin(false)
        setNoticeType('error')
        setNotice(roleError ? 'No se pudo verificar tu permiso de administrador.' : 'Esta cuenta no tiene permiso para administrar usuarios.')
        setAdminLoading(false)
        return
      }

      setIsAdmin(true)
      const { data, error } = await manageUsers({ action: 'list' })
      if (cancelled) return
      if (error) {
        setNoticeType('error')
        setNotice('No se pudo cargar los usuarios. Verifica que la función admin-users esté desplegada.')
      } else {
        setUsers(data?.users || [])
      }
      setAdminLoading(false)
    }

    loadUsers().catch(() => {
      if (cancelled) return
      setNoticeType('error')
      setNotice('No se pudo conectar con el servicio de administración.')
      setAdminLoading(false)
    })

    return () => { cancelled = true }
  }, [userId])

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('es-CL')
    if (!normalizedSearch) return users
    return users.filter((user) => `${user.fullName} ${user.email}`.toLocaleLowerCase('es-CL').includes(normalizedSearch))
  }, [users, search])

  async function refreshUsers() {
    const { data, error } = await manageUsers({ action: 'list' })
    if (error) throw error
    setUsers(data?.users || [])
  }

  async function handleSaveUser(event) {
    event.preventDefault()
    setBusy(true)
    setNotice('')
    const payload = editingUserId
      ? { action: 'update', userId: editingUserId, email: email.trim(), fullName: fullName.trim(), ...(password ? { password } : {}) }
      : { action: 'create', email: email.trim(), fullName: fullName.trim(), password }

    const { error } = await manageUsers(payload)
    if (error) {
      setNoticeType('error')
      setNotice('No se pudo guardar el usuario. Revisa el correo y que la contraseña tenga al menos 8 caracteres.')
      setBusy(false)
      return
    }

    try {
      await refreshUsers()
      setNoticeType('success')
      setNotice(editingUserId ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.')
      setEditingUserId(null)
      setEmail('')
      setFullName('')
      setPassword('')
    } catch {
      setNoticeType('error')
      setNotice('El usuario se guardó, pero no se pudo actualizar la lista.')
    }
    setBusy(false)
  }

  function startEditingUser(user) {
    setEditingUserId(user.id)
    setEmail(user.email)
    setFullName(user.fullName)
    setPassword('')
    setNotice('')
  }

  function cancelEditing() {
    setEditingUserId(null)
    setEmail('')
    setFullName('')
    setPassword('')
  }

  async function handleUserStatus(user) {
    const action = user.enabled ? 'inhabilitar' : 'habilitar'
    if (!window.confirm(`¿Deseas ${action} la cuenta de ${user.email}?`)) return

    setBusy(true)
    setNotice('')
    const { error } = await manageUsers({ action: 'set-status', userId: user.id, enabled: !user.enabled })
    if (error) {
      setNoticeType('error')
      setNotice('No se pudo cambiar el estado del usuario.')
      setBusy(false)
      return
    }

    try {
      await refreshUsers()
      setNoticeType('success')
      setNotice(`Usuario ${user.enabled ? 'inhabilitado' : 'habilitado'} correctamente.`)
    } catch {
      setNoticeType('error')
      setNotice('El estado se cambió, pero no se pudo actualizar la lista.')
    }
    setBusy(false)
  }

  async function handleLogout() {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  return (
    <main className="admin-users-page">
      <header className="admin-users-heading">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN</p>
          <h1>Administrar usuarios</h1>
          <p>Crea cuentas, actualiza sus datos y controla su acceso.</p>
        </div>
        {session && <button type="button" onClick={handleLogout}>Cerrar sesión</button>}
      </header>

      {!isSupabaseConfigured && <p className="category-admin-notice">Configura Supabase para administrar usuarios.</p>}
      {isSupabaseConfigured && authLoading && <p className="category-admin-notice">Comprobando sesión...</p>}
      {isSupabaseConfigured && !authLoading && !session && <p className="category-admin-notice">Inicia sesión con una cuenta administradora autorizada para ver los usuarios registrados.</p>}
      {isSupabaseConfigured && !authLoading && !session && <form className="category-admin-login" onSubmit={async (event) => {
        event.preventDefault()
        if (!supabase) return
        setBusy(true)
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          setNoticeType('error')
          setNotice('No se pudo iniciar sesión. Revisa tus credenciales.')
        }
        setBusy(false)
      }}>
        <label>Correo electrónico<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button type="submit" disabled={busy}>{busy ? 'Ingresando...' : 'Iniciar sesión'}</button>
      </form>}
      {isSupabaseConfigured && session && adminLoading && <p className="category-admin-notice">Cargando usuarios...</p>}
      {isSupabaseConfigured && session && isAdmin && !adminLoading && <section className="admin-users-content">
        <form className="admin-users-form" onSubmit={handleSaveUser}>
          <h2>{editingUserId ? 'Editar usuario' : 'Crear usuario'}</h2>
          <label>Nombre<input required maxLength={100} value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
          <label>Correo electrónico<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Contraseña<input type="password" minLength={8} required={!editingUserId} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={editingUserId ? 'Dejar vacío para conservarla' : 'Mínimo 8 caracteres'} /></label>
          <div className="admin-users-form-actions">
            <button type="submit" disabled={busy}>{editingUserId ? 'Guardar cambios' : 'Crear usuario'}</button>
            {editingUserId && <button type="button" onClick={cancelEditing}>Cancelar</button>}
          </div>
        </form>

        <section className="admin-users-list">
          <div className="admin-users-list-heading"><h2>Usuarios ({users.length})</h2><input aria-label="Buscar usuarios" type="search" placeholder="Buscar nombre o correo" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          {filteredUsers.length ? <ul className="admin-users-rows">{filteredUsers.map((user) => <li className="admin-users-row" key={user.id}>
            <div className="admin-users-identity"><strong>{user.fullName || 'Sin nombre'}</strong><span>{user.email}</span><small>{user.isAdmin ? 'Administrador' : 'Usuario'} · {user.enabled ? 'Habilitado' : 'Inhabilitado'}</small></div>
            <div className="admin-users-actions">
              <button type="button" disabled={busy} onClick={() => startEditingUser(user)}>Editar</button>
              <button type="button" disabled={busy || user.isAdmin} onClick={() => handleUserStatus(user)}>{user.enabled ? 'Inhabilitar' : 'Habilitar'}</button>
            </div>
          </li>)}</ul> : <p className="category-admin-notice">No hay usuarios que coincidan con la búsqueda.</p>}
        </section>
      </section>}
      {notice && <div className={`category-admin-toast category-admin-toast--${noticeType}`} role={noticeType === 'error' ? 'alert' : 'status'}>
        <span className="category-admin-toast-icon" aria-hidden="true">{noticeType === 'success' ? '✓' : '!'}</span>
        <p>{notice}</p>
        <button type="button" aria-label="Cerrar aviso" onClick={() => setNotice('')}>×</button>
      </div>}
    </main>
  )
}