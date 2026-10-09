import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { isCategoryAdmin, isSupabaseConfigured, listAllServices, REPORTS_CHANGED_EVENT, setServiceActive, supabase } from '../../utils/supabase'

const FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'active', label: 'Activas' },
  { id: 'paused', label: 'Pausadas' },
  { id: 'hidden', label: 'Ocultas' },
  { id: 'reported', label: 'Con reportes' },
]

function normalize(text) {
  return String(text || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function serviceStatus(service) {
  if (service.hidden_by_admin) return { id: 'hidden', label: 'Oculta por moderación' }
  return service.is_active ? { id: 'active', label: 'Publicada' } : { id: 'paused', label: 'Pausada por su dueño' }
}

export default function AdminServicesPage() {
  const location = useLocation()
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [adminLoading, setAdminLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [services, setServices] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState(null)
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

  const loadServices = useCallback(async () => {
    const { data, error } = await listAllServices()
    if (error) {
      setNoticeType('error')
      setNotice(error.message)
      return
    }
    setServices(data)
  }, [])

  useEffect(() => {
    if (!userId) {
      setAdminLoading(false)
      setIsAdmin(false)
      setServices([])
      return
    }

    let cancelled = false
    setAdminLoading(true)

    async function load() {
      const { data: authorized, error } = await isCategoryAdmin()
      if (cancelled) return
      if (error || !authorized) {
        setIsAdmin(false)
        setNoticeType('error')
        setNotice(error ? 'No se pudo verificar tu permiso de administrador.' : 'Esta cuenta no tiene permiso para ver las publicaciones.')
        setAdminLoading(false)
        return
      }

      setIsAdmin(true)
      await loadServices()
      if (!cancelled) setAdminLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [userId, loadServices])

  const counts = useMemo(() => {
    const result = { all: services.length, active: 0, paused: 0, hidden: 0, reported: 0 }
    for (const service of services) {
      result[serviceStatus(service).id] += 1
      if (Number(service.total_reports) > 0) result.reported += 1
    }
    return result
  }, [services])

  const visibleServices = useMemo(() => {
    const term = normalize(search).trim()
    return services.filter((service) => {
      const matchesFilter = filter === 'all' || (filter === 'reported' ? Number(service.total_reports) > 0 : serviceStatus(service).id === filter)
      const matchesSearch = !term || normalize(`${service.title} ${service.provider_name} ${service.category} ${service.location}`).includes(term)
      return matchesFilter && matchesSearch
    })
  }, [services, filter, search])

  async function toggleHidden(service) {
    const hide = !service.hidden_by_admin
    const confirmed = !hide || window.confirm(`¿Ocultar «${service.title}»? Su dueño recibirá un aviso y no podrá reactivarla hasta que la muestres de nuevo.`)
    if (!confirmed) return

    setBusyId(service.id)
    setNotice('')
    const { error } = await setServiceActive(service.id, !hide)
    if (error) {
      setNoticeType('error')
      setNotice(error.message)
    } else {
      await loadServices()
      window.dispatchEvent(new Event(REPORTS_CHANGED_EVENT))
      setNoticeType('success')
      setNotice(hide ? 'La publicación quedó oculta.' : 'La publicación volvió a estar visible.')
    }
    setBusyId(null)
  }

  return (
    <main className="admin-users-page admin-reports-page">
      <header className="admin-users-heading">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN</p>
          <h1>Publicaciones</h1>
          <p>Busca cualquier publicación de la plataforma y oculta las que incumplan las reglas.</p>
        </div>
        <Link className="admin-services-link" to="/admin/reportes">Ver reportes →</Link>
      </header>

      {!isSupabaseConfigured && <p className="category-admin-notice">Configura Supabase para ver las publicaciones.</p>}
      {isSupabaseConfigured && authLoading && <p className="category-admin-notice">Comprobando sesión...</p>}
      {isSupabaseConfigured && !authLoading && !session && <p className="category-admin-notice">Inicia sesión con una cuenta administradora para ver las publicaciones. <Link to="/cuenta" state={{ backgroundLocation: location }}>Iniciar sesión →</Link></p>}
      {isSupabaseConfigured && session && adminLoading && <p className="category-admin-notice">Cargando publicaciones...</p>}
      {isSupabaseConfigured && session && isAdmin && !adminLoading && <section className="admin-reports-content">
        <input className="admin-services-search" type="search" aria-label="Buscar publicaciones" placeholder="Buscar por título, profesional, categoría o comuna" value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="admin-reports-filters" role="tablist" aria-label="Filtrar por estado">
          {FILTERS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} className={filter === item.id ? 'is-active' : ''} onClick={() => setFilter(item.id)}>{item.label} <small>{counts[item.id]}</small></button>)}
        </div>

        {visibleServices.length ? <ul className="admin-reports-list">{visibleServices.map((service) => {
          const status = serviceStatus(service)
          return <li className="admin-report" key={service.id}>
            <div className="admin-report-main">
              <div className="admin-report-top">
                <span className={`admin-service-status admin-service-status--${status.id}`}>{status.label}</span>
                {Number(service.pending_reports) > 0 && <span className="admin-report-hidden">{service.pending_reports} {Number(service.pending_reports) === 1 ? 'reporte pendiente' : 'reportes pendientes'}</span>}
                <time dateTime={service.created_at}>{new Date(service.created_at).toLocaleDateString('es-CL')}</time>
              </div>
              <p className="admin-report-service"><Link to={`/servicio/${service.id}`}>{service.title}</Link></p>
              <small className="admin-report-reporter">{service.provider_name} · {service.category} · {service.location}</small>
            </div>
            <div className="admin-users-actions admin-report-actions">
              {service.hidden_by_admin
                ? <button type="button" disabled={busyId === service.id} onClick={() => toggleHidden(service)}>Mostrar publicación</button>
                : service.is_active && <button type="button" disabled={busyId === service.id} onClick={() => toggleHidden(service)}>Ocultar publicación</button>}
              {Number(service.total_reports) > 0 && <Link className="admin-services-link" to="/admin/reportes">Ver reportes ({service.total_reports})</Link>}
            </div>
          </li>
        })}</ul> : <p className="category-admin-notice">No hay publicaciones que coincidan.</p>}
      </section>}
      {notice && <div className={`category-admin-toast category-admin-toast--${noticeType}`} role={noticeType === 'error' ? 'alert' : 'status'}>
        <span className="category-admin-toast-icon" aria-hidden="true">{noticeType === 'success' ? '✓' : '!'}</span>
        <p>{notice}</p>
        <button type="button" aria-label="Cerrar aviso" onClick={() => setNotice('')}>×</button>
      </div>}
    </main>
  )
}
