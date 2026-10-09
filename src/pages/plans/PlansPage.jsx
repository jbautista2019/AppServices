import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { getMyPromotions, getPremiumPlans, getUserServices, isSupabaseConfigured, requestPromotion, supabase } from '../../utils/supabase'
import { isPremium } from '../../utils/featured'

const FREE_FEATURES = [
  'Publica tus servicios sin costo',
  'Aparece en el buscador y en las categorías',
  'Recibe mensajes y valoraciones de tus clientes',
  'Perfil público con tu teléfono y WhatsApp',
]

const STEPS = [
  ['1', 'Elige un plan y una publicación', 'Escoge cuánto tiempo quieres destacar y cuál de tus servicios promocionar.'],
  ['2', 'Confirmamos tu solicitud', 'Nuestro equipo revisa la solicitud y coordina contigo el pago del plan.'],
  ['3', 'Tu publicación sale en la portada', 'Al activarse, aparece primero en «Profesionales más buscados» con la insignia Premium.'],
]

const FAQ = [
  ['¿Dónde aparece mi publicación premium?', 'En la portada, dentro de «Profesionales más buscados», antes que las publicaciones sin plan, y con la insignia Premium en las tarjetas y en el detalle. Los lugares premium rotan cada día para que todas tengan visibilidad.'],
  ['¿Cuánto dura el plan?', 'Lo que indica el plan elegido, contado desde que lo activamos. Cuando vence, tu publicación sigue publicada con normalidad, solo deja de estar destacada.'],
  ['¿Puedo renovar el plan?', 'Sí. Cuando venza podrás solicitar otro plan para la misma publicación.'],
  ['¿Cuántas publicaciones puedo promocionar?', 'Cada plan se aplica a una publicación. Si quieres destacar varias, solicita un plan para cada una.'],
]

const STATUS_LABELS = { pending: 'Pendiente de activación', active: 'Activo', rejected: 'Rechazada', cancelled: 'Finalizada' }

const formatPrice = (amount) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount)
const formatDate = (value) => new Date(value).toLocaleDateString('es-CL')

function promotionLabel(promotion) {
  if (promotion.status === 'active') {
    return promotion.ends_at && Date.parse(promotion.ends_at) <= Date.now() ? 'Vencida' : `Activa hasta el ${formatDate(promotion.ends_at)}`
  }
  return STATUS_LABELS[promotion.status] || promotion.status
}

export default function PlansPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [plans, setPlans] = useState([])
  const [plansError, setPlansError] = useState('')
  const [plansLoading, setPlansLoading] = useState(true)
  const [services, setServices] = useState([])
  const [promotions, setPromotions] = useState([])
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [serviceId, setServiceId] = useState(searchParams.get('servicio') || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const userId = session?.user?.id

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
    let cancelled = false
    getPremiumPlans().then(({ data, error: loadError }) => {
      if (cancelled) return
      setPlans(data)
      setPlansError(loadError ? loadError.message : '')
      setPlansLoading(false)
    }).catch(() => {
      if (!cancelled) setPlansLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const loadMine = useCallback(async () => {
    const [servicesResult, promotionsResult] = await Promise.all([getUserServices(userId), getMyPromotions()])
    setServices(servicesResult.data || [])
    setPromotions(promotionsResult.error ? [] : promotionsResult.data)
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setServices([])
      setPromotions([])
      return
    }
    loadMine().catch(() => {})
  }, [userId, loadMine])

  // Publicaciones que se pueden promocionar: activas, visibles, sin plan vigente ni solicitud pendiente.
  const eligible = useMemo(() => {
    const pending = new Set(promotions.filter((promotion) => promotion.status === 'pending').map((promotion) => String(promotion.service_id)))
    return services.filter((service) => service.is_active && !service.hidden_by_admin && !isPremium(service) && !pending.has(String(service.id)))
  }, [services, promotions])

  function choosePlan(plan) {
    if (!session) {
      navigate('/cuenta', { state: { backgroundLocation: location } })
      return
    }
    setError('')
    setSent(false)
    setSelectedPlan(plan)
    const preselected = searchParams.get('servicio')
    setServiceId(eligible.some((service) => String(service.id) === preselected) ? preselected : eligible[0] ? String(eligible[0].id) : '')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!serviceId) {
      setError('Elige la publicación que quieres promocionar.')
      return
    }

    setBusy(true)
    setError('')
    const { error: requestError } = await requestPromotion(Number(serviceId), selectedPlan.id)
    setBusy(false)
    if (requestError) {
      setError(requestError.message)
      return
    }
    setSent(true)
    loadMine().catch(() => {})
  }

  const selectedService = services.find((service) => String(service.id) === String(serviceId))

  return <main className="plans-page">
    <header className="plans-hero">
      <p className="eyebrow">PLANES PREMIUM</p>
      <h1>Haz que más clientes te encuentren</h1>
      <p>Destaca tu servicio en la portada de Oficios Cerca y aparece antes que el resto cuando las personas buscan a un profesional como tú.</p>
    </header>

    {!isSupabaseConfigured && <p className="plans-notice">Configura Supabase para ver y solicitar planes.</p>}

    <section className="plans-grid" aria-label="Planes disponibles">
      <article className="plan-card">
        <h2>Gratis</h2>
        <p className="plan-description">Para empezar a recibir clientes.</p>
        <p className="plan-price"><strong>{formatPrice(0)}</strong></p>
        <ul className="plan-features">{FREE_FEATURES.map((feature) => <li key={feature}>{feature}</li>)}</ul>
        <Link className="plan-button plan-button--ghost" to="/servicio/nuevo">Publicar un servicio</Link>
      </article>

      {plansLoading && <article className="plan-card plan-card--placeholder"><p>Cargando planes...</p></article>}
      {plans.map((plan) => <article className={`plan-card${plan.highlighted ? ' plan-card--highlighted' : ''}`} key={plan.id}>
        {plan.highlighted && <span className="plan-ribbon">Más conveniente</span>}
        <h2><span aria-hidden="true">★</span> {plan.name}</h2>
        {plan.description && <p className="plan-description">{plan.description}</p>}
        <p className="plan-price"><strong>{formatPrice(plan.price_clp)}</strong><small> por {plan.days} días · {formatPrice(Math.round(plan.price_clp / (plan.days / 30)))} al mes</small></p>
        <ul className="plan-features">{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
        <button type="button" className="plan-button" disabled={authLoading} onClick={() => choosePlan(plan)}>Elegir este plan</button>
      </article>)}
      {!plansLoading && !plans.length && <article className="plan-card plan-card--placeholder">
        <p>Estamos preparando los planes premium. Vuelve pronto.</p>
        {plansError && <small>{plansError}</small>}
      </article>}
    </section>

    {userId && <section className="plans-mine" aria-labelledby="plans-mine-title">
      <h2 id="plans-mine-title">Mis solicitudes</h2>
      {promotions.length ? <ul>{promotions.map((promotion) => <li key={promotion.id}>
        <div>
          <strong>{promotion.service_title}</strong>
          <small>{promotion.plan_name} · {formatPrice(promotion.price_clp)} · solicitado el {formatDate(promotion.requested_at)}</small>
        </div>
        <span className={`plan-status plan-status--${promotion.status}`}>{promotionLabel(promotion)}</span>
      </li>)}</ul> : <p>Aún no has solicitado ningún plan. Elige uno arriba para destacar una de tus publicaciones.</p>}
    </section>}

    <section className="plans-steps" aria-labelledby="plans-steps-title">
      <h2 id="plans-steps-title">Cómo funciona</h2>
      <ol>{STEPS.map(([number, title, text]) => <li key={number}><span className="plans-step-number" aria-hidden="true">{number}</span><div><strong>{title}</strong><p>{text}</p></div></li>)}</ol>
    </section>

    <section className="plans-faq" aria-labelledby="plans-faq-title">
      <h2 id="plans-faq-title">Preguntas frecuentes</h2>
      {FAQ.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
    </section>

    {selectedPlan && <div className="report-backdrop" onClick={() => setSelectedPlan(null)}>
      <div className="report-dialog plans-dialog" role="dialog" aria-modal="true" aria-labelledby="plans-dialog-title" onClick={(event) => event.stopPropagation()}>
        {sent ? <>
          <h2 id="plans-dialog-title">¡Solicitud enviada!</h2>
          <p>Recibimos tu solicitud de <strong>{selectedPlan.name}</strong> para «{selectedService?.title}». Nuestro equipo la revisará, coordinará contigo el pago y la activará. Te avisaremos en tus notificaciones.</p>
          <div className="report-actions"><button type="button" className="report-submit" onClick={() => setSelectedPlan(null)}>Entendido</button></div>
        </> : <form onSubmit={handleSubmit}>
          <h2 id="plans-dialog-title">{selectedPlan.name}</h2>
          <p>{formatPrice(selectedPlan.price_clp)} por {selectedPlan.days} días. Elige la publicación que quieres promocionar.</p>
          {eligible.length ? <label className="plans-dialog-field">Publicación
            <select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
              {eligible.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}
            </select>
          </label> : <p className="report-error" role="status">No tienes publicaciones disponibles para promocionar. Deben estar activas y sin una solicitud pendiente ni un plan vigente. <Link to="/servicio/nuevo">Crear una publicación</Link></p>}
          <p className="plans-dialog-note">La activación no es automática: un administrador revisa la solicitud y coordina el pago contigo.</p>
          {error && <p className="report-error" role="alert">{error}</p>}
          <div className="report-actions">
            <button type="button" className="report-cancel" onClick={() => setSelectedPlan(null)}>Cancelar</button>
            <button type="submit" className="report-submit" disabled={busy || !eligible.length}>{busy ? 'Enviando...' : 'Solicitar plan'}</button>
          </div>
        </form>}
      </div>
    </div>}
  </main>
}
