import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getPremiumPlans, isSupabaseConfigured } from '../../utils/supabase'

const ICONS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  account: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>,
  publish: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
  wait: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  agree: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="m9 16 2 2 4-4" /></>,
  service: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
  shield: <><path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  pin: <><path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  phone: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>,
  briefcase: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></>,
  community: <><circle cx="9" cy="7" r="3.5" /><circle cx="17" cy="9" r="2.5" /><path d="M2 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" /><path d="M17 14a4 4 0 0 1 4 4v1" /></>,
  review: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
}

const PROFESSIONS = ['Gasfíteres', 'Carpinteros', 'Electricistas', 'Cerrajeros', 'Aseadores de hogares', 'Y más...']

const OFFER = [
  { icon: 'shield', title: 'Seguridad y confianza', text: 'Perfiles con valoraciones reales y sistema de chat interno.' },
  { icon: 'pin', title: 'Cobertura local y a domicilio', text: 'Encuentra profesionales en tu comuna y alrededores.' },
  { icon: 'phone', title: 'Fácil de usar', text: 'Desde cualquier dispositivo, en pocos pasos.' },
]

const PROMO_BENEFITS = [
  'Mayor visibilidad en la plataforma',
  'Insignia Premium en tu publicación y en tu perfil',
  'Llega a más clientes potenciales',
]

const BENEFITS = [
  { icon: 'briefcase', title: 'Para los profesionales', text: 'Más clientes, más oportunidades y mayor visibilidad.' },
  { icon: 'user', title: 'Para los usuarios', text: 'Encuentra rápido, fácil y seguro al profesional que necesitas.' },
  { icon: 'community', title: 'Para la comunidad', text: 'Servicios de calidad que impulsan el desarrollo local.' },
]

const formatPrice = (amount) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount)

function Icon({ name, className }) {
  return <svg className={className} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{ICONS[name]}</svg>
}

const STEPS = [
  {
    icon: 'search',
    title: 'La persona llega',
    text: 'El usuario entra a la página web desde su computador o celular y busca el servicio que necesita, escribiendo en el buscador o navegando por categorías.',
  },
  {
    icon: 'account',
    title: 'Crea su cuenta',
    text: 'Se registra de forma rápida y gratuita en la plataforma con su correo o con su cuenta de Google.',
  },
  {
    icon: 'publish',
    title: 'Publica su servicio',
    text: 'El profesional entra a «Mis servicios» y completa los datos de lo que ofrece: categoría, descripción, precio referencial, comuna, modalidad (local comercial o a domicilio) y fotos.',
  },
  {
    icon: 'wait',
    title: 'Espera que lo contacten',
    text: 'Una vez publicado, el servicio queda visible para quienes buscan profesionales. El interesado puede ver tu perfil, revisar tus datos y contactarte a través del chat de la plataforma.',
  },
  {
    icon: 'chat',
    title: 'Recibe la oferta o consulta',
    text: 'El profesional recibe la solicitud y puede hacer preguntas, confirmar disponibilidad y acordar los detalles del servicio.',
  },
  {
    icon: 'agree',
    title: 'Confirma y coordina',
    text: 'Ambas partes acuerdan el servicio. Pueden coordinar la dirección, la hora y los detalles finales por el chat de la plataforma.',
  },
  {
    icon: 'service',
    title: 'Realiza el servicio',
    text: 'El profesional se dirige al domicilio del cliente o presta el servicio en su ubicación (local comercial).',
  },
  {
    icon: 'review',
    title: 'Servicio completado',
    text: 'El cliente confirma la finalización del servicio y puede dejar una valoración. El profesional la solicita desde el chat con «Solicitar valoración». Esto genera confianza y ayuda a otros usuarios a elegir.',
  },
]

export default function HowItWorksPage() {
  const location = useLocation()
  const [lowestPrice, setLowestPrice] = useState(null)

  // El precio sale de los planes reales (el más económico), no de un valor fijo en la página.
  useEffect(() => {
    if (!isSupabaseConfigured) return

    let cancelled = false
    getPremiumPlans().then(({ data }) => {
      if (cancelled || !data?.length) return
      setLowestPrice(Math.min(...data.map((plan) => plan.price_clp)))
    }).catch(() => {})

    return () => { cancelled = true }
  }, [])

  return <main className="how-page">
    <header className="how-hero">
      <div className="how-hero-copy">
        <p className="eyebrow">CÓMO FUNCIONA</p>
        <h1>Conecta con profesionales de confianza</h1>
        <p>Publica tu servicio, recibe consultas y contrata de forma fácil, rápida y segura.</p>
      </div>
      <div className="how-hero-areas">
        <strong>Servicios locales y a domicilio en todo Santiago y alrededores</strong>
        <ul>{PROFESSIONS.map((profession) => <li key={profession}>{profession}</li>)}</ul>
      </div>
    </header>

    <ol className="how-steps">
      {STEPS.map((step, index) => <li className="how-step" key={step.title}>
        <div className="how-step-head">
          <span className="how-step-number" aria-hidden="true">{index + 1}</span>
          <h2>{step.title}</h2>
        </div>
        <svg className="how-step-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{ICONS[step.icon]}</svg>
        <p>{step.text}</p>
      </li>)}
    </ol>

    <section className="how-cta" aria-label="Comienza ahora">
      <div>
        <h2>¿Listo para empezar?</h2>
        <p>Encuentra al profesional que necesitas o publica tu servicio gratis.</p>
      </div>
      <div className="how-cta-actions">
        <Link className="how-cta-primary" to="/buscar">Buscar servicios</Link>
        <Link className="how-cta-secondary" to="/registro" state={{ backgroundLocation: location }}>Crear una cuenta</Link>
      </div>
    </section>

    <section className="how-offer" aria-label="Qué ofrecemos">
      <article className="how-panel how-panel--offer">
        <h2>¿Qué te ofrecemos?</h2>
        <ul className="how-offer-list">{OFFER.map((item) => <li key={item.title}>
          <Icon name={item.icon} className="how-offer-icon" />
          <strong>{item.title}</strong>
          <p>{item.text}</p>
        </li>)}</ul>
      </article>

      <article className="how-panel how-panel--promo">
        <h2>¿Cuánto cuesta promocionar tu servicio?</h2>
        <div className="how-price">
          <Icon name="review" className="how-price-star" />
          <div>
            {lowestPrice !== null ? <><span>Desde</span> <strong>{formatPrice(lowestPrice)}</strong></> : <strong>Planes premium</strong>}
            <small>por una promoción destacada</small>
          </div>
        </div>
        <ul className="how-promo-list">{PROMO_BENEFITS.map((benefit) => <li key={benefit}><span aria-hidden="true">✓</span>{benefit}</li>)}</ul>
        <p className="how-promo-link"><Link to="/planes">Ver planes y precios <span aria-hidden="true">→</span></Link></p>
      </article>

      <article className="how-panel how-panel--benefits">
        <h2>Beneficios para todos</h2>
        <ul className="how-benefits-list">{BENEFITS.map((item) => <li key={item.title}>
          <Icon name={item.icon} className="how-benefit-icon" />
          <div><strong>{item.title}</strong><p>{item.text}</p></div>
        </li>)}</ul>
      </article>
    </section>
  </main>
}
