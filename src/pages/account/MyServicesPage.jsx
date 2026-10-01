import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteService, getUserServices, updateService } from '../../utils/supabase'

function formatDate(date) {
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long' }).format(new Date(date))
}

function ActionIcon({ name }) {
  const iconPaths = {
    view: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
    pause: <><path d="M8 5v14" /><path d="M16 5v14" /></>,
    resume: <path d="m8 5 12 7-12 7Z" />,
    delete: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m19 6-1 14H6L5 6" /><path d="M10 11v5M14 11v5" /></>,
  }

  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{iconPaths[name]}</svg>
}

export default function MyServicesPage({ userId }) {
  const [services, setServices] = useState([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyServiceId, setBusyServiceId] = useState(null)

  useEffect(() => {
    if (!userId) {
      setServices([])
      setServicesLoading(false)
      return
    }

    let cancelled = false
    setServicesLoading(true)
    setLoadError('')

    getUserServices(userId).then(({ data, error }) => {
      if (cancelled) return
      if (error) setLoadError('No se pudieron cargar tus servicios. Inténtalo nuevamente.')
      else setServices(data || [])
      setServicesLoading(false)
    }).catch(() => {
      if (cancelled) return
      setLoadError('No se pudieron cargar tus servicios. Inténtalo nuevamente.')
      setServicesLoading(false)
    })

    return () => { cancelled = true }
  }, [userId])

  async function handleToggleActive(service) {
    setBusyServiceId(service.id)
    setActionError('')

    try {
      const { error } = await updateService(service.id, userId, { is_active: !service.is_active })
      if (error) throw error

      setServices((current) => current.map((item) => item.id === service.id ? { ...item, is_active: !service.is_active } : item))
    } catch {
      setActionError('No se pudo cambiar el estado del servicio. Inténtalo nuevamente.')
    } finally {
      setBusyServiceId(null)
    }
  }

  async function handleDelete(service) {
    const confirmed = window.confirm(`¿Eliminar "${service.title}"? Esta acción no se puede deshacer.`)
    if (!confirmed) return

    setBusyServiceId(service.id)
    setActionError('')

    try {
      const { error } = await deleteService(service.id, userId)
      if (error) throw error

      setServices((current) => current.filter((item) => item.id !== service.id))
    } catch {
      setActionError('No se pudo eliminar el servicio. Inténtalo nuevamente.')
    } finally {
      setBusyServiceId(null)
    }
  }

  const servicesByDate = services.reduce((groups, service) => {
    const dateKey = service.created_at ? new Date(service.created_at).toISOString().slice(0, 10) : 'sin-fecha'
    groups[dateKey] ||= []
    groups[dateKey].push(service)
    return groups
  }, {})

  return <section className="my-services-content">
    <div className="my-services-heading">
      <div>
        <h1>Mis servicios</h1>
      </div>
      <span>{services.length} {services.length === 1 ? 'servicio' : 'servicios'}</span>
    </div>

    {servicesLoading ? <p className="my-services-message">Cargando tus servicios...</p> : loadError ? <p className="my-services-message" role="alert">{loadError}</p> : <>
      {actionError && <p className="my-services-message my-services-error" role="alert">{actionError}</p>}
      {services.length === 0 ? <p className="my-services-message">Aún no tienes servicios publicados.</p> : <div className="my-services-groups">
      {Object.entries(servicesByDate).map(([date, items]) => <section className="my-services-group" key={date}>
        <header className="my-services-group-heading">
          <span>{date === 'sin-fecha' ? 'Fecha no disponible' : formatDate(date)}</span>
        </header>
        <ul className="my-services-list">
          {items.map((service) => <li className="my-service-row" key={service.id}>
            <Link to={`/servicio/${service.id}`} className="my-service-image-link" aria-label={`Ver ${service.title}`}>
              {service.image_url ? <img src={service.image_url} alt="" /> : <span>{service.category?.slice(0, 1) || 'S'}</span>}
            </Link>
            <div className="my-service-description">
              <span className={`my-service-status ${service.is_active ? 'is-active' : 'is-paused'}`}>{service.is_active ? 'Publicado' : 'Pausado'}</span>
              <strong>{service.title}</strong>
              <span>{service.category} · {service.location}</span>
              <small>Desde ${Number(service.starting_price || 0).toLocaleString('es-CL')}</small>
            </div>
            <div className="my-service-provider">
              <span>{service.provider_name || 'Tu servicio'}</span>
              <span>{Number(service.rating || 0).toFixed(1)} ★</span>
            </div>
            <div className="my-service-actions">
              <Link className="my-service-action my-service-action--view" to={`/servicio/${service.id}`} aria-label={`Ver ${service.title}`} title="Ver servicio"><ActionIcon name="view" /></Link>
              <Link className="my-service-action my-service-action--edit" to={`/servicio/${service.id}/editar`} aria-label={`Editar ${service.title}`} title="Editar servicio"><ActionIcon name="edit" /></Link>
              <button className="my-service-action my-service-action--toggle" type="button" disabled={busyServiceId === service.id} onClick={() => handleToggleActive(service)} aria-label={service.is_active ? `Pausar ${service.title}` : `Reactivar ${service.title}`} title={service.is_active ? 'Pausar servicio' : 'Reactivar servicio'}><ActionIcon name={service.is_active ? 'pause' : 'resume'} /></button>
              <button className="my-service-action my-service-action--delete" type="button" disabled={busyServiceId === service.id} onClick={() => handleDelete(service)} aria-label={`Eliminar ${service.title}`} title="Eliminar servicio"><ActionIcon name="delete" /></button>
            </div>
          </li>)}
        </ul>
      </section>)}
      </div>}
    </>}
  </section>
}