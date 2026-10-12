import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { deleteAppointment, getMyChatClients, getPremiumAccess, getUserServices, isSupabaseConfigured, listProviderAppointments, markAppointmentShared, saveAppointment, sendConversationMessage, setAppointmentStatus, supabase } from '../../utils/supabase'
import { validatePhone, whatsappUrl } from '../../utils/phone'

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240]
const STATUS_LABELS = { scheduled: 'Agendada', completed: 'Completada', cancelled: 'Cancelada', no_show: 'No asistió' }
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const pad = (value) => String(value).padStart(2, '0')
const toDateInput = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const toTimeInput = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`
const dayKey = (value) => toDateInput(new Date(value))
const parseDayKey = (key) => {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1)
const formatDay = (value) => capitalize(new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(value)))
const formatLongDay = (value) => capitalize(new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value)))
const formatMonth = (date) => capitalize(new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(date))
const formatTime = (value) => new Date(value).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
const isUpcoming = (appointment) => appointment.status === 'scheduled' && Date.parse(appointment.ends_at) >= Date.now()

// Celdas del mes (empieza en lunes) con los días de relleno de los meses vecinos.
const OTHER_CLIENT = '__other'

function buildMonthCells(monthStart) {
  const year = monthStart.getFullYear()
  const month = monthStart.getMonth()
  const lead = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const total = Math.ceil((lead + daysInMonth) / 7) * 7
  return Array.from({ length: total }, (_, index) => {
    const date = new Date(year, month, index - lead + 1)
    return { date, key: toDateInput(date), inMonth: date.getMonth() === month }
  })
}

// Texto de la cita para compartir con el cliente (sin las notas privadas).
function buildShareText(appointment, { forChat }) {
  const place = appointment.mode ? `${appointment.mode === 'home' ? 'A domicilio' : 'Local comercial'}${appointment.address ? ` - ${appointment.address}` : ''}` : appointment.address
  const lines = [
    '📅 Cita agendada',
    `Fecha: ${formatLongDay(appointment.starts_at)}`,
    `Hora: ${formatTime(appointment.starts_at)} a ${formatTime(appointment.ends_at)}`,
    appointment.service_title ? `Servicio: ${appointment.service_title}` : '',
    place ? `Lugar: ${place}` : '',
    forChat ? '/mis-citas' : '',
  ]
  return lines.filter(Boolean).join('\n')
}

function emptyForm(dateKey) {
  const start = new Date()
  start.setHours(start.getHours() + 1, 0, 0, 0)
  return { id: null, clientType: 'external', clientId: '', name: '', phone: '', email: '', serviceId: '', date: dateKey || toDateInput(start), time: dateKey ? '10:00' : toTimeInput(start), duration: '60', mode: '', address: '', notes: '' }
}

function formFromAppointment(appointment) {
  const start = new Date(appointment.starts_at)
  return {
    id: appointment.id,
    clientType: appointment.client_id ? 'platform' : 'external',
    clientId: appointment.client_id || '',
    name: appointment.client_id ? '' : appointment.client_name,
    phone: appointment.client_phone || '',
    email: appointment.client_email || '',
    serviceId: appointment.service_id ? String(appointment.service_id) : '',
    date: toDateInput(start),
    time: toTimeInput(start),
    duration: String(Math.round((Date.parse(appointment.ends_at) - Date.parse(appointment.starts_at)) / 60000)),
    mode: appointment.mode || '',
    address: appointment.address || '',
    notes: appointment.notes || '',
  }
}

export default function AgendaPage() {
  const location = useLocation()
  const panelRef = useRef(null)
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [premium, setPremium] = useState(null)
  const [appointments, setAppointments] = useState([])
  const [chatClients, setChatClients] = useState([])
  const [services, setServices] = useState([])
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState(null)
  const [form, setForm] = useState(null)
  const [shareOffer, setShareOffer] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [saving, setSaving] = useState(false)
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

  const loadAppointments = useCallback(async () => {
    const { data, error } = await listProviderAppointments(userId)
    if (error) {
      setNoticeType('error')
      setNotice(error.message)
      return []
    }
    setAppointments(data)
    return data
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setPremium(null)
      setAppointments([])
      return
    }

    let cancelled = false
    async function start() {
      const { data: hasAccess, error } = await getPremiumAccess()
      if (cancelled) return
      if (error) {
        setNoticeType('error')
        setNotice(error.message)
      }
      setPremium(hasAccess)
      if (!hasAccess) return

      const [, clientsResult, servicesResult] = await Promise.all([loadAppointments(), getMyChatClients(userId), getUserServices(userId)])
      if (cancelled) return
      setChatClients(clientsResult.data || [])
      setServices(servicesResult.data || [])
    }

    start().catch(() => {
      if (!cancelled) setPremium(false)
    })
    return () => { cancelled = true }
  }, [userId, loadAppointments])

  const cells = useMemo(() => buildMonthCells(month), [month])
  const byDay = useMemo(() => {
    const map = new Map()
    for (const appointment of appointments) {
      const key = dayKey(appointment.starts_at)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(appointment)
    }
    for (const list of map.values()) list.sort((first, second) => Date.parse(first.starts_at) - Date.parse(second.starts_at))
    return map
  }, [appointments])
  const upcoming = useMemo(() => appointments.filter(isUpcoming).slice(0, 5), [appointments])
  const chatClientById = useMemo(() => new Map(chatClients.map((client) => [client.client_id, client])), [chatClients])
  const todayKey = toDateInput(new Date())
  const selectedAppointments = selectedDay ? byDay.get(selectedDay) || [] : []

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  function report(type, text) {
    setNoticeType(type)
    setNotice(text)
  }

  function focusPanel() {
    window.setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
  }

  function selectDay(key) {
    setSelectedDay(key)
    if (form) {
      if (key < todayKey) return
      // Con el formulario abierto solo se cambia la fecha: se conservan los demás datos.
      setForm((current) => ({ ...current, date: key }))
      return
    }
    setShareOffer(null)
    focusPanel()
  }

  function goToMonth(delta) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  function goToToday() {
    const now = new Date()
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    selectDay(toDateInput(now))
  }

  function openNewForm() {
    setShareOffer(null)
    setForm(emptyForm(selectedDay && selectedDay >= todayKey ? selectedDay : todayKey))
    focusPanel()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (form.clientType === 'platform' && !form.clientId) {
      report('error', 'Elige a la persona de la plataforma para la cita.')
      return
    }
    const phoneError = form.clientType === 'external' ? validatePhone(form.phone) : ''
    if (phoneError) {
      report('error', phoneError)
      return
    }

    const start = new Date(`${form.date}T${form.time}`)
    if (Number.isNaN(start.getTime())) {
      report('error', 'Elige una fecha y una hora válidas.')
      return
    }
    const end = new Date(start.getTime() + Number(form.duration) * 60000)
    const isEdit = Boolean(form.id)
    if (!isEdit && start.getTime() < Date.now()) {
      report('error', 'No puedes agendar una cita en una fecha u hora que ya pasó.')
      return
    }

    setSaving(true)
    setNotice('')
    const { data: savedId, error } = await saveAppointment({
      id: form.id,
      service_id: form.serviceId ? Number(form.serviceId) : null,
      client_id: form.clientType === 'platform' ? form.clientId : null,
      client_name: form.clientType === 'platform' ? '' : form.name,
      client_phone: form.clientType === 'platform' ? '' : form.phone,
      client_email: form.clientType === 'platform' ? '' : form.email,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      mode: form.mode || null,
      address: form.address,
      notes: form.notes,
    })
    setSaving(false)

    if (error) {
      report('error', error.message)
      return
    }

    const list = await loadAppointments()
    const saved = list.find((appointment) => appointment.id === savedId)
    setForm(null)
    setMonth(new Date(start.getFullYear(), start.getMonth(), 1))
    setSelectedDay(toDateInput(start))
    report('success', isEdit ? 'Cita actualizada.' : 'Cita agendada.')

    // Ofrece compartirla con el cliente (el profesional decide si lo envía).
    const canShareInChat = saved?.client_id && chatClientById.has(saved.client_id)
    const canShareWhatsapp = saved && !saved.client_id && whatsappUrl(saved.client_phone)
    if (saved && (canShareInChat || canShareWhatsapp)) setShareOffer({ appointment: saved, isEdit })
    focusPanel()
  }

  async function shareInChat(appointment) {
    const conversation = chatClientById.get(appointment.client_id)
    if (!conversation) {
      report('error', 'No encontramos el chat con esta persona.')
      return
    }

    setBusyId(appointment.id)
    setNotice('')
    const { error } = await sendConversationMessage(conversation.conversation_id, userId, buildShareText(appointment, { forChat: true }))
    if (error) {
      report('error', 'No se pudo enviar la cita al chat. Revisa que la conversación siga en tu bandeja de Mensajes e inténtalo de nuevo.')
      setBusyId(null)
      return
    }

    await markAppointmentShared(appointment.id)
    await loadAppointments()
    setShareOffer(null)
    report('success', `Cita compartida en el chat con ${appointment.client_name}.`)
    setBusyId(null)
  }

  async function markSharedViaWhatsapp(appointment) {
    await markAppointmentShared(appointment.id)
    await loadAppointments()
    setShareOffer(null)
  }

  async function changeStatus(appointment, status, successText) {
    setBusyId(appointment.id)
    setNotice('')
    const { error } = await setAppointmentStatus(appointment.id, status)
    if (error) report('error', error.message)
    else {
      await loadAppointments()
      report('success', successText)
    }
    setBusyId(null)
  }

  async function handleCancel(appointment) {
    const note = appointment.client_id ? ' Se avisará a la persona.' : ''
    if (!window.confirm(`¿Cancelar la cita con ${appointment.client_name}?${note}`)) return
    await changeStatus(appointment, 'cancelled', 'Cita cancelada.')
  }

  async function handleDelete(appointment) {
    if (!window.confirm(`¿Eliminar la cita con ${appointment.client_name}? No se puede deshacer.`)) return

    setBusyId(appointment.id)
    setNotice('')
    const { error } = await deleteAppointment(appointment.id)
    if (error) report('error', error.message)
    else {
      await loadAppointments()
      report('success', 'Cita eliminada.')
    }
    setBusyId(null)
  }

  const durationOptions = form && !DURATIONS.includes(Number(form.duration)) ? [...DURATIONS, Number(form.duration)].sort((a, b) => a - b) : DURATIONS

  function renderAppointment(appointment) {
    const busy = busyId === appointment.id
    const chatConversation = appointment.client_id ? chatClientById.get(appointment.client_id) : null
    const whatsapp = !appointment.client_id ? whatsappUrl(appointment.client_phone, buildShareText(appointment, { forChat: false })) : ''
    return <li className={`agenda-appointment agenda-appointment--${appointment.status}`} key={appointment.id}>
      <div className="agenda-time"><strong>{formatTime(appointment.starts_at)}</strong><span>{formatTime(appointment.ends_at)}</span></div>
      <div className="agenda-body">
        <div className="agenda-top">
          <strong>{appointment.client_name}</strong>
          <span className={`agenda-badge agenda-badge--${appointment.client_id ? 'platform' : 'external'}`}>{appointment.client_id ? 'Plataforma' : 'Externo'}</span>
          <span className={`agenda-status agenda-status--${appointment.status}`}>{STATUS_LABELS[appointment.status]}</span>
          {appointment.shared_at && <span className="agenda-badge agenda-badge--shared" title={`Compartida el ${new Date(appointment.shared_at).toLocaleDateString('es-CL')}`}>✓ Compartida</span>}
        </div>
        <p className="agenda-meta">
          {appointment.service_title && <span>{appointment.service_title}</span>}
          {appointment.mode && <span>{appointment.mode === 'home' ? 'A domicilio' : 'Local comercial'}</span>}
          {appointment.address && <span>{appointment.address}</span>}
          {appointment.client_phone && <span>{appointment.client_phone}</span>}
          {appointment.client_email && <span>{appointment.client_email}</span>}
        </p>
        {appointment.notes && <p className="agenda-notes">{appointment.notes}</p>}
        <div className="agenda-row-actions">
          {appointment.status === 'scheduled' ? <>
            <button type="button" disabled={busy} onClick={() => changeStatus(appointment, 'completed', 'Cita marcada como completada.')}>Completar</button>
            <button type="button" disabled={busy} onClick={() => changeStatus(appointment, 'no_show', 'Cita marcada como «no asistió».')}>No asistió</button>
            <button type="button" disabled={busy} onClick={() => handleCancel(appointment)}>Cancelar</button>
          </> : <button type="button" disabled={busy} onClick={() => changeStatus(appointment, 'scheduled', 'Cita agendada nuevamente.')}>Volver a agendar</button>}
          <button type="button" disabled={busy} onClick={() => { setForm(formFromAppointment(appointment)); setShareOffer(null); focusPanel() }}>Editar</button>
          <button type="button" disabled={busy} onClick={() => handleDelete(appointment)}>Eliminar</button>
          {chatConversation && appointment.status === 'scheduled' && <button type="button" className="agenda-share" disabled={busy} onClick={() => shareInChat(appointment)}>{appointment.shared_at ? 'Compartir de nuevo en el chat' : 'Compartir en el chat'}</button>}
          {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer">Enviar por WhatsApp</a>}
          {appointment.client_id && <Link to="/mensajes">Abrir chat</Link>}
        </div>
      </div>
    </li>
  }

  return <main className="agenda-page">
    <header className="agenda-heading">
      <div>
        <p className="eyebrow">AGENDA <span className="agenda-premium-tag">★ PREMIUM</span></p>
        <h1>Mi agenda de citas</h1>
        <p>Elige un día del calendario para ver o agendar tus citas, con clientes de la plataforma o externos.</p>
      </div>
      {premium && !form && <button type="button" className="agenda-new" onClick={openNewForm}>+ Nueva cita</button>}
    </header>

    {!isSupabaseConfigured && <p className="category-admin-notice">Configura Supabase para usar la agenda.</p>}
    {isSupabaseConfigured && authLoading && <p className="category-admin-notice">Comprobando sesión...</p>}
    {isSupabaseConfigured && !authLoading && !session && <p className="category-admin-notice">Inicia sesión para usar tu agenda. <Link to="/cuenta" state={{ backgroundLocation: location }}>Iniciar sesión →</Link></p>}
    {isSupabaseConfigured && session && premium === null && <p className="category-admin-notice">Cargando tu agenda...</p>}

    {session && premium === false && <section className="agenda-locked">
      <span className="agenda-lock-icon" aria-hidden="true">★</span>
      <h2>La agenda de citas es parte de los planes premium</h2>
      <p>Con un plan premium vigente puedes ver tus citas en un calendario mensual, agendarlas para clientes de la plataforma y externos, y compartir cada cita por el chat con tu cliente.</p>
      <ul>
        <li>Calendario mensual con el detalle de cada día</li>
        <li>Clientes de la plataforma (reciben aviso) y externos</li>
        <li>Compartir la cita en el chat cuando tú quieras</li>
        <li>Sin superposición de horarios</li>
      </ul>
      <Link className="agenda-cta" to="/planes">Ver planes premium <span aria-hidden="true">→</span></Link>
      <small>Si tu plan venció, tus citas se conservan y vuelven a estar disponibles al renovarlo.</small>
    </section>}

    {session && premium && <div className="agenda-layout">
      <section className="agenda-calendar" aria-label="Calendario">
        <div className="agenda-calendar-head">
          <button type="button" aria-label="Mes anterior" onClick={() => goToMonth(-1)}>‹</button>
          <h2 aria-live="polite">{formatMonth(month)}</h2>
          <button type="button" aria-label="Mes siguiente" onClick={() => goToMonth(1)}>›</button>
          <button type="button" className="agenda-today" onClick={goToToday}>Hoy</button>
        </div>
        <div className="agenda-weekdays" aria-hidden="true">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="agenda-grid">
          {cells.map((cell) => {
            const dayAppointments = byDay.get(cell.key) || []
            const active = dayAppointments.filter((appointment) => appointment.status === 'scheduled')
            const isPast = cell.key < todayKey
            const classes = ['agenda-cell', cell.inMonth ? '' : 'is-outside', cell.key === todayKey ? 'is-today' : '', cell.key === selectedDay ? 'is-selected' : '', dayAppointments.length ? 'has-appointments' : '', isPast ? 'is-past' : ''].filter(Boolean).join(' ')
            return <button type="button" key={cell.key} className={classes} aria-pressed={cell.key === selectedDay} disabled={isPast && !dayAppointments.length} aria-label={`${formatDay(cell.date)}${dayAppointments.length ? `, ${dayAppointments.length} ${dayAppointments.length === 1 ? 'cita' : 'citas'}` : ''}`} onClick={() => selectDay(cell.key)}>
              <span className="agenda-cell-number">{cell.date.getDate()}</span>
              <span className="agenda-chips">
                {dayAppointments.slice(0, 2).map((appointment) => <span key={appointment.id} className={`agenda-chip agenda-chip--${appointment.status}`}>{formatTime(appointment.starts_at)} {appointment.client_name}</span>)}
                {dayAppointments.length > 2 && <span className="agenda-more">+{dayAppointments.length - 2} más</span>}
              </span>
              {dayAppointments.length > 0 && <span className="agenda-count" aria-hidden="true">{active.length || dayAppointments.length}</span>}
            </button>
          })}
        </div>
        <ul className="agenda-legend" aria-hidden="true">
          <li><i className="agenda-chip--scheduled" /> Agendada</li>
          <li><i className="agenda-chip--completed" /> Completada</li>
          <li><i className="agenda-chip--cancelled" /> Cancelada / no asistió</li>
        </ul>
      </section>

      <aside className="agenda-panel" ref={panelRef} aria-label="Detalle del día">
        {form ? <form className="agenda-form" onSubmit={handleSubmit}>
          <h2>{form.id ? 'Editar cita' : 'Nueva cita'}</h2>

          <label className="agenda-wide">Cliente
            <select
              value={form.clientType === 'platform' ? form.clientId : OTHER_CLIENT}
              disabled={!chatClients.length}
              onChange={(event) => {
                const value = event.target.value
                setForm((current) => ({ ...current, clientType: value === OTHER_CLIENT ? 'external' : 'platform', clientId: value === OTHER_CLIENT ? '' : value }))
              }}
            >
              {chatClients.map((client) => <option key={client.client_id} value={client.client_id}>{client.client_name}</option>)}
              <option value={OTHER_CLIENT}>Otro (cliente externo)</option>
            </select>
            <small>{chatClients.length ? 'Las personas que te escribieron por el chat recibirán un aviso con la cita.' : 'Aún nadie te ha escrito por el chat: agenda como cliente externo.'}</small>
          </label>

          {form.clientType === 'external' && <>
            <label className="agenda-wide">Nombre del cliente<input required maxLength={120} value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Ej. María González" /></label>
            <label>Teléfono (opcional)<input type="tel" maxLength={30} value={form.phone} onChange={(event) => updateField('phone', event.target.value)} placeholder="+56 9 1234 5678" /></label>
            <label>Correo (opcional)<input type="email" maxLength={120} value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="cliente@correo.cl" /></label>
          </>}

          <label>Fecha<input required type="date" min={form.id ? undefined : todayKey} value={form.date} onChange={(event) => updateField('date', event.target.value)} /></label>
          <label>Hora de inicio<input required type="time" value={form.time} onChange={(event) => updateField('time', event.target.value)} /></label>
          <label>Duración<select value={form.duration} onChange={(event) => updateField('duration', event.target.value)}>
            {durationOptions.map((minutes) => <option key={minutes} value={minutes}>{minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`}</option>)}
          </select></label>
          <label>Servicio (opcional)<select value={form.serviceId} onChange={(event) => updateField('serviceId', event.target.value)}>
            <option value="">Sin asociar</option>
            {services.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}
          </select></label>
          <label>Lugar<select value={form.mode} onChange={(event) => updateField('mode', event.target.value)}>
            <option value="">Sin definir</option>
            <option value="local">Local comercial</option>
            <option value="home">A domicilio</option>
          </select></label>
          <label className="agenda-wide">Dirección (opcional)<input maxLength={200} value={form.address} onChange={(event) => updateField('address', event.target.value)} placeholder="Dónde se realizará el servicio" /></label>
          <label className="agenda-wide">Notas privadas (opcional)<textarea rows={3} maxLength={1000} value={form.notes} onChange={(event) => updateField('notes', event.target.value)} placeholder="Solo tú las ves; no se comparten con el cliente" /></label>

          <div className="agenda-actions agenda-wide">
            <button type="submit" disabled={saving}>{saving ? 'Guardando...' : form.id ? 'Guardar cambios' : 'Agendar cita'}</button>
            <button type="button" disabled={saving} onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </form> : selectedDay ? <section className="agenda-day-detail">
          <header>
            <h2>{formatLongDay(parseDayKey(selectedDay))}</h2>
            {selectedDay >= todayKey ? <button type="button" className="agenda-new" onClick={openNewForm}>+ Agendar este día</button> : <small className="agenda-empty">Este día ya pasó: no se pueden agendar citas.</small>}
          </header>

          {shareOffer && <div className="agenda-share-offer" role="status">
            <strong>{shareOffer.isEdit ? 'Cita actualizada.' : 'Cita guardada.'} ¿Quieres compartirla con {shareOffer.appointment.client_name}?</strong>
            <p>Se enviará un mensaje con la fecha, la hora y el lugar. Las notas privadas no se comparten.</p>
            <div className="agenda-row-actions">
              {shareOffer.appointment.client_id
                ? <button type="button" className="agenda-share" disabled={busyId === shareOffer.appointment.id} onClick={() => shareInChat(shareOffer.appointment)}>{busyId === shareOffer.appointment.id ? 'Enviando...' : 'Compartir en el chat'}</button>
                : <a className="agenda-share" href={whatsappUrl(shareOffer.appointment.client_phone, buildShareText(shareOffer.appointment, { forChat: false }))} target="_blank" rel="noopener noreferrer" onClick={() => markSharedViaWhatsapp(shareOffer.appointment)}>Enviar por WhatsApp</a>}
              <button type="button" onClick={() => setShareOffer(null)}>Ahora no</button>
            </div>
          </div>}

          {selectedAppointments.length ? <ul className="agenda-list">{selectedAppointments.map(renderAppointment)}</ul> : <p className="agenda-empty">No hay citas este día.</p>}
        </section> : <section className="agenda-day-detail">
          <h2>Próximas citas</h2>
          {upcoming.length ? <ul className="agenda-upcoming">{upcoming.map((appointment) => <li key={appointment.id}>
            <button type="button" onClick={() => { setMonth(new Date(new Date(appointment.starts_at).getFullYear(), new Date(appointment.starts_at).getMonth(), 1)); selectDay(dayKey(appointment.starts_at)) }}>
              <strong>{formatDay(appointment.starts_at)} · {formatTime(appointment.starts_at)}</strong>
              <span>{appointment.client_name}{appointment.service_title ? ` · ${appointment.service_title}` : ''}</span>
            </button>
          </li>)}</ul> : <p className="agenda-empty">No tienes citas próximas. Selecciona un día del calendario para agendar la primera.</p>}
        </section>}
      </aside>
    </div>}

    {notice && <div className={`category-admin-toast category-admin-toast--${noticeType}`} role={noticeType === 'error' ? 'alert' : 'status'}>
      <span className="category-admin-toast-icon" aria-hidden="true">{noticeType === 'success' ? '✓' : '!'}</span>
      <p>{notice}</p>
      <button type="button" aria-label="Cerrar aviso" onClick={() => setNotice('')}>×</button>
    </div>}
  </main>
}
