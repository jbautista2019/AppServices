import { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { createCategory, deleteCategory, getCategories, getPublishedServices, isCategoryAdmin, isSupabaseConfigured, manageUsers, supabase, updateCategory } from './lib/supabase'
import './categoryAdmin.css'

function Header() {
  return <header className="site-header"><Link to="/" className="brand"><span className="brand-mark">OC</span><span>oficios <i>cerca</i></span></Link><nav><Link to="/buscar">Explorar servicios</Link><Link to="/prestadores">Ofrece tus servicios</Link><Link to="/admin/categorias">Categorías</Link><Link to="/admin/usuarios">Usuarios</Link></nav><div className="header-actions"><button className="icon-button" aria-label="Notificaciones">♧</button><Link className="header-account-link" to="/cuenta">Entrar</Link><Link className="user-button" to="/registro">Crear cuenta <span>→</span></Link></div></header>
}

function Home({ services, categories, loading }) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const submit = (event) => { event.preventDefault(); navigate(`/buscar${query ? `?q=${encodeURIComponent(query)}` : ''}`) }
  return <>
    <section className="hero"><div className="hero-copy"><p className="eyebrow">EL SERVICIO QUE NECESITAS, MÁS CERCA</p><h1>Encuentra a alguien que <em>lo haga bien.</em></h1><p className="hero-lead">Conecta con personas reales, recomendadas y disponibles para ayudarte en lo cotidiano.</p><form className="search-bar" onSubmit={submit}><span className="search-icon">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="¿Qué servicio estás buscando?" /><button type="submit">Buscar <span>→</span></button></form><div className="search-hint"><span>⌖</span> Explora servicios disponibles cerca de ti</div></div><div className="hero-art"><div className="art-note">Personas reales.<br /><strong>Trabajos bien hechos.</strong></div><div className="art-circle"><span>✦</span></div></div></section>
    <main className="home-content"><section className="section-heading"><div><p className="eyebrow">TODO LO QUE BUSCAS</p><h2>Explora por categoría</h2></div><Link to="/buscar" className="text-link">Ver todas <span>→</span></Link></section><div className="category-grid">{categories.map((category) => { const count = services.filter((service) => service.category === category.name).length; return <Link to={`/buscar?category=${encodeURIComponent(category.name)}`} className="category-tile" key={category.name}>{category.image_url ? <img className="category-icon" src={category.image_url} alt="" /> : <span className="category-icon">✦</span>}<strong>{category.name}</strong><small>{count.toLocaleString('es-CL')} {count === 1 ? 'servicio' : 'servicios'}</small><span className="tile-arrow">↗</span></Link> })}{!loading && !categories.length && <p>No hay categorías publicadas todavía.</p>}{loading && !categories.length && <p>Cargando categorías...</p>}</div><section className="feature-band"><div><p className="eyebrow">PARA QUIENES HACEN</p><h2>Tu oficio merece<br /><em>ser encontrado.</em></h2><p>Publica tus servicios gratis y llega a personas que necesitan exactamente lo que tú sabes hacer.</p><Link to="/prestadores" className="dark-button">Quiero ofrecer mis servicios <span>→</span></Link></div><div className="feature-quote"><span>“</span><p>Encontré un electricista para mi mamá en menos de diez minutos.</p><small>— Camila, La Reina</small></div></section></main>
  </>
}

function AccountPage({ initialMode }) {
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
          <button type="button" onClick={handleLogout}>Cerrar sesión</button>
        </div> : <>
          <div className="account-tabs" role="tablist" aria-label="Acceso a la cuenta">
            <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')}>Crear cuenta</button>
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Iniciar sesión</button>
          </div>
          <form className="account-form" onSubmit={handleSubmit}>
            {mode === 'signup' && <label>Nombre completo<input autoComplete="name" maxLength={100} required value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>}
            <label>Correo electrónico<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Contraseña<input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'signup' ? 'Mínimo 8 caracteres' : ''} /></label>
            {mode === 'signup' && <label>Confirmar contraseña<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>}
            <button type="submit" disabled={busy}>{busy ? 'Procesando...' : mode === 'signup' ? 'Crear cuenta' : 'Iniciar sesión'}</button>
          </form>
          {notice && <p className={`account-notice account-notice--${noticeType}`} role={noticeType === 'error' ? 'alert' : 'status'}>{notice}</p>}
        </>}
      </section>
    </main>
  )
}

const SERVICES_PER_PAGE = 6

function SearchPage({ services, categories, loading, loadError }) {
  const params = new URLSearchParams(window.location.search)
  const [query, setQuery] = useState(params.get('q') || '')
  const [category, setCategory] = useState(params.get('category') || 'Todas')
  const [location, setLocation] = useState('')
  const [minimumPrice, setMinimumPrice] = useState('')
  const [maximumPrice, setMaximumPrice] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const filtered = useMemo(() => {
    const locationQuery = location.trim().toLocaleLowerCase('es-CL')

    return services.filter((service) => {
      const matchesQuery = !query || `${service.title} ${service.provider_name} ${service.category} ${service.location}`.toLowerCase().includes(query.toLowerCase())
      const matchesCategory = category === 'Todas' || service.category === category
      const matchesLocation = !locationQuery || (service.location || '').toLocaleLowerCase('es-CL').includes(locationQuery)
      const price = Number(service.starting_price)
      const matchesMinimumPrice = minimumPrice === '' || price >= Number(minimumPrice)
      const matchesMaximumPrice = maximumPrice === '' || price <= Number(maximumPrice)

      return matchesQuery && matchesCategory && matchesLocation && matchesMinimumPrice && matchesMaximumPrice
    })
  }, [query, category, location, minimumPrice, maximumPrice, services])
  const pageCount = Math.ceil(filtered.length / SERVICES_PER_PAGE)
  const visibleServices = filtered.slice((currentPage - 1) * SERVICES_PER_PAGE, currentPage * SERVICES_PER_PAGE)

  return (
    <main className="results-page">
      <div className="results-intro">
        <p className="eyebrow">SERVICIOS CERCA DE TI</p>
        <h1>Encuentra lo que necesitas.</h1>
        <div className="compact-search">
          <span>⌕</span>
          <input value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1) }} placeholder="Busca por servicio, nombre o comuna" />
          <button aria-label="Buscar">→</button>
        </div>
      </div>
      <div className="results-layout">
        <aside className="filters">
          <div className="filter-title">
            <strong>Filtrar resultados</strong>
            <button onClick={() => { setQuery(''); setCategory('Todas'); setLocation(''); setMinimumPrice(''); setMaximumPrice(''); setCurrentPage(1) }}>Limpiar</button>
          </div>
          <label>
            Servicio o categoría
            <select value={category} onChange={(event) => { setCategory(event.target.value); setCurrentPage(1) }}>
              <option>Todas</option>
              {categories.map((item) => <option key={item.name}>{item.name}</option>)}
            </select>
          </label>
          <label>
            Ubicación
            <input className="filter-input" type="search" aria-label="Filtrar por ubicación" placeholder="Comuna o ciudad" value={location} onChange={(event) => { setLocation(event.target.value); setCurrentPage(1) }} />
          </label>
          <label>
            Precio referencial
            <div className="price-row">
              <input type="number" min="0" step="1000" aria-label="Precio mínimo" placeholder="Desde" value={minimumPrice} onChange={(event) => { setMinimumPrice(event.target.value); setCurrentPage(1) }} />
              <input type="number" min="0" step="1000" aria-label="Precio máximo" placeholder="Hasta" value={maximumPrice} onChange={(event) => { setMaximumPrice(event.target.value); setCurrentPage(1) }} />
            </div>
          </label>
          <label className="check-label"><input type="checkbox" /> Solo disponibles</label>
        </aside>
        <section className="listing">
          <div className="listing-top">
            <span><strong>{loading ? '...' : filtered.length}</strong> servicios encontrados</span>
            <select aria-label="Ordenar"><option>Más relevantes</option><option>Mejor evaluados</option><option>Precio menor</option></select>
          </div>
          {loadError && <p className="data-notice">{loadError}</p>}
          {visibleServices.map((service) => <ServiceCard service={service} key={service.id} />)}
          {!loading && !filtered.length && <div className="empty-state"><strong>No encontramos publicaciones</strong><p>Cuando haya servicios activos en Supabase, aparecerán aquí.</p></div>}
          {pageCount > 1 && <nav className="pagination" aria-label="Paginación de servicios"><button type="button" aria-label="Página anterior" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>←</button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => <button type="button" key={page} className={currentPage === page ? 'active' : ''} aria-current={currentPage === page ? 'page' : undefined} onClick={() => setCurrentPage(page)}>{page}</button>)}<button type="button" aria-label="Página siguiente" onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} disabled={currentPage === pageCount}>→</button></nav>}
        </section>
      </div>
    </main>
  )
}

function formatPrice(amount) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount)
}

function ServiceCard({ service }) { return <article className="service-card">{service.image_url && <img src={service.image_url} alt="" />}<div className="service-card-body"><div className="card-top"><span className="category-label">{service.category}</span><button className="save-button" aria-label="Guardar servicio">♡</button></div><Link to={`/servicio/${service.id}`}><h2>{service.title}</h2></Link><p className="provider">{service.provider_name} <span className="verified">✓</span></p><div className="service-meta"><span>★ {Number(service.rating).toFixed(1)}</span><span>⌖ {service.location}</span></div><div className="card-bottom"><span>Desde <strong>{formatPrice(service.starting_price)}</strong></span><Link to={`/servicio/${service.id}`} className="small-link">Ver servicio <span>→</span></Link></div></div></article> }

function ServiceDetail({ services, loading, loadError }) {
  const { id } = useParams()
  const service = services.find((item) => String(item.id) === id)

  if (loading) return <main className="detail-page"><p>Cargando publicación...</p></main>
  if (!service) return <main className="detail-page"><Link to="/buscar" className="back-link">← Volver a resultados</Link><p>{loadError || 'Esta publicación no está disponible.'}</p></main>

  return <main className="detail-page"><Link to="/buscar" className="back-link">← Volver a resultados</Link><div className="detail-grid"><div>{service.image_url && <img className="detail-image" src={service.image_url} alt={service.title} />}</div><section className="detail-copy"><span className="category-label">{service.category}</span><h1>{service.title}</h1><p className="detail-provider">{service.provider_name} <span className="verified">✓</span></p><div className="detail-rating"><strong>★ {Number(service.rating).toFixed(1)}</strong><span>⌖ {service.location}</span></div><hr /><h3>Sobre este servicio</h3><p className="description">{service.description}</p><div className="contact-box"><div><strong>¿Te interesa este servicio?</strong><small>Responde normalmente en menos de una hora.</small></div><button className="dark-button">Contactar <span>→</span></button></div></section></div></main>
}

function Providers() { return <main className="provider-page"><div className="provider-intro"><p className="eyebrow">PARA PRESTADORES</p><h1>Haz que tu oficio<br /><em>llegue más lejos.</em></h1><p>Ofrece tus servicios de forma gratuita y encuentra nuevos clientes en tu comuna.</p><button className="dark-button">Crear mi perfil <span>→</span></button></div><div className="provider-steps">{[['01', 'Crea tu perfil', 'Cuéntanos quién eres y qué sabes hacer.'], ['02', 'Publica tu servicio', 'Agrega tus fotos, precios y zonas de atención.'], ['03', 'Conecta con clientes', 'Recibe contactos de personas interesadas.']].map(([number, title, text]) => <div className="step" key={number}><span>{number}</span><h2>{title}</h2><p>{text}</p></div>)}</div></main> }

function CategoriesAdminPage() {
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

function AdminUsersPage() {
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

function App() {
  const [services, setServices] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [loadError, setLoadError] = useState(isSupabaseConfigured ? '' : 'Configura Supabase para cargar publicaciones.')

  useEffect(() => {
    if (!isSupabaseConfigured) return

    let cancelled = false
    Promise.all([getPublishedServices(), getCategories()]).then(([serviceResult, categoryResult]) => {
      if (cancelled) return
      if (serviceResult.error) setLoadError('No pudimos cargar las publicaciones desde Supabase.')
      else setServices(serviceResult.data || [])
      if (categoryResult.error) setLoadError('No pudimos cargar categorías. Ejecuta el schema.sql actualizado en Supabase.')
      else setCategories(categoryResult.data || [])
      setLoading(false)
    }).catch(() => {
      if (cancelled) return
      setLoadError('No pudimos conectar con Supabase.')
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [])

  return <><Header /><Routes><Route path="/" element={<Home services={services} categories={categories} loading={loading} />} /><Route path="/buscar" element={<SearchPage services={services} categories={categories} loading={loading} loadError={loadError} />} /><Route path="/servicio/:id" element={<ServiceDetail services={services} loading={loading} loadError={loadError} />} /><Route path="/prestadores" element={<Providers />} /><Route path="/cuenta" element={<AccountPage initialMode="login" />} /><Route path="/registro" element={<AccountPage initialMode="signup" />} /><Route path="/admin/categorias" element={<CategoriesAdminPage />} /><Route path="/admin/usuarios" element={<AdminUsersPage />} /></Routes><footer><span>oficios <i>cerca</i></span><small>Una forma más humana de encontrar ayuda.</small><span>© 2026</span></footer></>
}

export default App