import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { getPremiumPlans, isSupabaseConfigured } from '../../utils/supabase'

const ICONS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  compare: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" /><path d="M8 14h3" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z" />,
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  agree: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="m9 16 2 2 4-4" /></>,
  review: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  account: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>,
  publish: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
  manage: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="10" cy="18" r="1.6" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  service: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
  shield: <><path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  pin: <><path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  phone: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>,
  briefcase: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></>,
  community: <><circle cx="9" cy="7" r="3.5" /><circle cx="17" cy="9" r="2.5" /><path d="M2 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" /><path d="M17 14a4 4 0 0 1 4 4v1" /></>,
}

const TABS = [
  { id: 'cliente', label: 'Si buscas un servicio', icon: 'search' },
  { id: 'profesional', label: 'Si ofreces un servicio', icon: 'briefcase' },
]

const PROFESSIONS = ['Gasfíteres', 'Carpinteros', 'Electricistas', 'Cerrajeros', 'Aseadores de hogares', 'Y más...']

// Recorrido de quien busca un servicio.
const CLIENT_STEPS = [
  {
    icon: 'search',
    title: 'Busca lo que necesitas',
    text: 'Escribe en el buscador lo que necesitas, incluso con tus propias palabras (por ejemplo «me gotea el techo»), o explora por categorías. Puedes filtrar por comuna y precio.',
  },
  {
    icon: 'compare',
    title: 'Compara y elige',
    text: 'Revisa fotos, descripción, precio referencial y comuna, y si atiende en local comercial o a domicilio. Mira las valoraciones y el perfil público del profesional.',
  },
  {
    icon: 'heart',
    title: 'Guarda tus favoritos',
    text: 'Toca el corazón de las publicaciones que te interesen para volver a ellas cuando quieras. Solo necesitas una cuenta gratis, con tu correo o con Google.',
  },
  {
    icon: 'chat',
    title: 'Contáctalo',
    text: 'Escríbele por el chat de la plataforma o, si el profesional publicó su teléfono, por WhatsApp. Si algo de la publicación no te parece bien, puedes reportarla.',
  },
  {
    icon: 'agree',
    title: 'Coordina el servicio',
    text: 'Acuerden por el chat el precio final, la dirección o el lugar, el día y la hora. Te avisamos en la campana cuando recibas una respuesta.',
  },
  {
    icon: 'review',
    title: 'Valora tu experiencia',
    text: 'Cuando el servicio termina, el profesional puede enviarte una solicitud de valoración por el chat. Elige de 1 a 5 estrellas y deja un comentario opcional para ayudar a otros.',
  },
]

// Recorrido de quien ofrece un servicio.
const PROFESSIONAL_STEPS = [
  {
    icon: 'account',
    title: 'Crea tu cuenta gratis',
    text: 'Regístrate con tu correo o con Google. En «Mi perfil» agrega tu teléfono para recibir consultas por WhatsApp y una breve descripción tuya.',
  },
  {
    icon: 'publish',
    title: 'Publica tu servicio',
    text: 'En «Mis servicios» pulsa «Crear servicio» y completa título, categoría, comuna, precio referencial, fotos, descripción y modalidad: local comercial, a domicilio o ambas. Publicar es gratis.',
  },
  {
    icon: 'manage',
    title: 'Gestiona tus publicaciones',
    text: 'Tu servicio aparece en el buscador y en su categoría. Puedes editarlo, pausarlo cuando no tengas disponibilidad o eliminarlo en cualquier momento.',
  },
  {
    icon: 'bell',
    title: 'Recibe consultas',
    text: 'Los interesados te escriben por el chat o por WhatsApp. Te avisamos en la campana de cada mensaje nuevo para que respondas rápido.',
  },
  {
    icon: 'service',
    title: 'Presta el servicio y pide tu valoración',
    text: 'Atiende en tu local comercial o en el domicilio del cliente. Al terminar, usa «Solicitar valoración» en el chat para que tu cliente te califique.',
  },
  {
    icon: 'review',
    title: 'Destaca tu publicación (opcional)',
    text: 'Solicita un plan premium en «Planes». Nuestro equipo confirma la solicitud y la activa: tu publicación aparece primero en la portada con la insignia Premium.',
  },
]

const OFFER = [
  { icon: 'shield', title: 'Seguridad y confianza', text: 'Perfiles con valoraciones reales y sistema de chat interno.' },
  { icon: 'pin', title: 'Cobertura local y a domicilio', text: 'Encuentra profesionales en tu comuna y alrededores.' },
  { icon: 'phone', title: 'Fácil de usar', text: 'Desde cualquier dispositivo, en pocos pasos.' },
]

const PROMO_BENEFITS = [
  'Mayor visibilidad: apareces primero en la portada',
  'Insignia Premium en las tarjetas y en el detalle',
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

function Track({ id, eyebrow, title, intro, steps, children }) {
  return <div className="how-track">
    <header className="how-track-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id}>{title}</h2>
        <p>{intro}</p>
      </div>
      <div className="how-track-actions">{children}</div>
    </header>
    <ol className="how-steps">
      {steps.map((step, index) => <li className="how-step" key={step.title}>
        <div className="how-step-head">
          <span className="how-step-number" aria-hidden="true">{index + 1}</span>
          <h3>{step.title}</h3>
        </div>
        <Icon name={step.icon} className="how-step-icon" />
        <p>{step.text}</p>
      </li>)}
    </ol>
  </div>
}

export default function HowItWorksPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get('para') === 'profesional' ? 'profesional' : 'cliente')
  const [lowestPrice, setLowestPrice] = useState(null)

  function handleTabKeyDown(event, index) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? TABS.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length
    setActiveTab(TABS[next].id)
    document.getElementById(`how-tab-${TABS[next].id}`)?.focus()
  }

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
        <p>Encuentra el servicio que necesitas o publica el tuyo, y coordina todo por el chat de la plataforma.</p>
      </div>
      <div className="how-hero-areas">
        <strong>Servicios locales y a domicilio en todo Santiago y alrededores</strong>
        <ul>{PROFESSIONS.map((profession) => <li key={profession}>{profession}</li>)}</ul>
      </div>
    </header>

    <div className="how-tabs" role="tablist" aria-label="Elige tu recorrido">
      {TABS.map((tab, index) => <button
        key={tab.id}
        id={`how-tab-${tab.id}`}
        className={`how-tab${activeTab === tab.id ? ' active' : ''}`}
        type="button"
        role="tab"
        aria-selected={activeTab === tab.id}
        aria-controls={`how-panel-${tab.id}`}
        tabIndex={activeTab === tab.id ? 0 : -1}
        onClick={() => setActiveTab(tab.id)}
        onKeyDown={(event) => handleTabKeyDown(event, index)}
      >
        <Icon name={tab.icon} className="how-tab-icon" />
        {tab.label}
      </button>)}
    </div>

    <div className="how-tabpanel" id="how-panel-cliente" role="tabpanel" aria-labelledby="how-tab-cliente" hidden={activeTab !== 'cliente'}>
      <Track
        id="how-client-title"
        eyebrow="SI BUSCAS UN SERVICIO"
        title="Encuentra al profesional que necesitas"
        intro="Buscar y comparar es gratis y no necesitas cuenta; la creas solo cuando quieras contactar o guardar favoritos."
        steps={CLIENT_STEPS}
      >
        <Link className="how-cta-primary" to="/buscar">Buscar servicios</Link>
      </Track>
    </div>

    <div className="how-tabpanel" id="how-panel-profesional" role="tabpanel" aria-labelledby="how-tab-profesional" hidden={activeTab !== 'profesional'}>
      <Track
        id="how-pro-title"
        eyebrow="SI OFRECES UN SERVICIO"
        title="Publica tu servicio y consigue clientes"
        intro="Publicar es gratis. Tú decides tu precio, tu comuna y si atiendes en tu local comercial, a domicilio o ambas."
        steps={PROFESSIONAL_STEPS}
      >
        <Link className="how-cta-primary" to="/servicio/nuevo">Publicar mi servicio</Link>
        <Link className="how-cta-secondary" to="/registro" state={{ backgroundLocation: location }}>Crear una cuenta</Link>
      </Track>
    </div>

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
