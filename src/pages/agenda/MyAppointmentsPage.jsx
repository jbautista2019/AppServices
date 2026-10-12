import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { isSupabaseConfigured, listMyClientAppointments, supabase } from '../../utils/supabase'

const STATUS_LABELS = { scheduled: 'Agendada', completed: 'Completada', cancelled: 'Cancelada', no_show: 'No asistió' }
const formatDate = (value) => {
  const text = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value))
  return text.charAt(0).toUpperCase() + text.slice(1)
}
const formatTime = (value) => new Date(value).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
const isUpcoming = (appointment) => appointment.status === 'scheduled' && Date.parse(appointment.ends_at) >= Date.now()

// Citas que un profesional agendó para ti desde la plataforma. Solo se ve fecha, lugar y estado.
export default function MyAppointmentsPage() {
  const location = useLocation()
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [appointments, setAppointments] = useState(null)
  const [error, setError] = useState('')

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
      setAppointments(null)
      return
    }

    let cancelled = false
    listMyClientAppointments().then(({ data, error: loadError }) => {
      if (cancelled) return
      if (loadError) setError(loadError.message)
      setAppointments(loadError ? [] : data)
    }).catch(() => {
      if (!cancelled) setAppointments([])
    })
    return () => { cancelled = true }
  }, [userId])

  const upcoming = useMemo(() => (appointments || []).filter(isUpcoming), [appointments])
  const past = useMemo(() => (appointments || []).filter((appointment) => !isUpcoming(appointment)).reverse(), [appointments])

  function renderList(list) {
    return <ul className="agenda-client-list">{list.map((appointment) => <li className={`agenda-appointment agenda-appointment--${appointment.status}`} key={appointment.id}>
      <div className="agenda-time"><strong>{formatTime(appointment.starts_at)}</strong><span>{formatTime(appointment.ends_at)}</span></div>
      <div className="agenda-body">
        <div className="agenda-top">
          <strong>{formatDate(appointment.starts_at)}</strong>
          <span className={`agenda-status agenda-status--${appointment.status}`}>{STATUS_LABELS[appointment.status]}</span>
        </div>
        <p className="agenda-meta">
          <span>Con {appointment.provider_name || 'el profesional'}</span>
          {appointment.service_title && <span>{appointment.service_title}</span>}
          {appointment.mode && <span>{appointment.mode === 'home' ? 'A domicilio' : 'Local comercial'}</span>}
          {appointment.address && <span>{appointment.address}</span>}
        </p>
        <div className="agenda-row-actions"><Link to="/mensajes">Escribir al profesional</Link></div>
      </div>
    </li>)}</ul>
  }

  return <main className="agenda-page">
    <header className="agenda-heading">
      <div>
        <p className="eyebrow">MIS CITAS</p>
        <h1>Mis citas</h1>
        <p>Las citas que un profesional agendó para ti. Te avisamos en la campana cuando agenda, mueve o cancela una.</p>
      </div>
    </header>

    {!isSupabaseConfigured && <p className="category-admin-notice">Configura Supabase para ver tus citas.</p>}
    {isSupabaseConfigured && authLoading && <p className="category-admin-notice">Comprobando sesión...</p>}
    {isSupabaseConfigured && !authLoading && !session && <p className="category-admin-notice">Inicia sesión para ver tus citas. <Link to="/cuenta" state={{ backgroundLocation: location }}>Iniciar sesión</Link></p>}
    {session && appointments === null && <p className="category-admin-notice">Cargando tus citas...</p>}
    {error && <p className="category-admin-notice" role="alert">{error}</p>}
    {session && appointments && !error && <>
      <section className="agenda-day">
        <h2>Próximas</h2>
        {upcoming.length ? renderList(upcoming) : <p className="category-admin-notice">No tienes citas próximas.</p>}
      </section>
      {past.length > 0 && <section className="agenda-day">
        <h2>Anteriores</h2>
        {renderList(past)}
      </section>}
    </>}
  </main>
}
