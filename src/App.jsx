import { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { getPublishedServices, isSupabaseConfigured } from './lib/supabase'

const categories = [
  { name: 'Hogar', icon: '⌂', count: '1.240 servicios' },
  { name: 'Belleza', icon: '✦', count: '860 servicios' },
  { name: 'Reparaciones', icon: '⚒', count: '530 servicios' },
  { name: 'Clases', icon: '▱', count: '310 servicios' },
  { name: 'Jardinería', icon: '❋', count: '185 servicios' },
  { name: 'Eventos', icon: '◌', count: '120 servicios' },
]

const demoServices = [
  { id: 1, name: 'Gasfitería Juan Pérez', provider: 'Juan Pérez', category: 'Hogar', location: 'Maipú', rating: '4.8', price: '$20.000', image: 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=900&q=80', description: 'Instalaciones, reparaciones y mantención de redes de agua y gas. Trabajo garantizado y atención el mismo día en comunas del poniente de Santiago.' },
  { id: 2, name: 'Manicure Studio Nati', provider: 'Natalia Rojas', category: 'Belleza', location: 'Ñuñoa', rating: '5.0', price: '$15.000', image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=80', description: 'Manicure permanente y diseños personalizados en un espacio tranquilo. También realizo atención a domicilio dentro de Ñuñoa y Providencia.' },
  { id: 3, name: 'TecnoFix Computación', provider: 'Matías Soto', category: 'Reparaciones', location: 'La Florida', rating: '4.9', price: '$18.000', image: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=900&q=80', description: 'Diagnóstico, limpieza y reparación de notebooks y computadores. Recuperación de datos y soporte remoto para pequeños negocios.' },
  { id: 4, name: 'Jardines Vivos', provider: 'Claudia Muñoz', category: 'Jardinería', location: 'Las Condes', rating: '4.7', price: '$25.000', image: 'https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&w=900&q=80', description: 'Diseño y mantención de jardines, poda y asesoría para que tus plantas crezcan sanas todo el año.' },
  { id: 5, name: 'Clases de Matemática', provider: 'Diego Araya', category: 'Clases', location: 'Providencia', rating: '4.9', price: '$12.000', image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=900&q=80', description: 'Clases particulares para enseñanza media y preparación PAES. Método práctico y material personalizado.' },
]

const services = demoServices

function Header() {
  return <header className="site-header"><Link to="/" className="brand"><span className="brand-mark">OC</span><span>oficios <i>cerca</i></span></Link><nav><Link to="/buscar">Explorar servicios</Link><Link to="/prestadores">Ofrece tus servicios</Link></nav><div className="header-actions"><button className="icon-button" aria-label="Notificaciones">♧</button><button className="user-button">Entrar <span>→</span></button></div></header>
}

function Home() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const submit = (event) => { event.preventDefault(); navigate(`/buscar${query ? `?q=${encodeURIComponent(query)}` : ''}`) }
  return <>
    <section className="hero"><div className="hero-copy"><p className="eyebrow">EL SERVICIO QUE NECESITAS, MÁS CERCA</p><h1>Encuentra a alguien que <em>lo haga bien.</em></h1><p className="hero-lead">Conecta con personas reales, recomendadas y disponibles para ayudarte en lo cotidiano.</p><form className="search-bar" onSubmit={submit}><span className="search-icon">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="¿Qué servicio estás buscando?" /><button type="submit">Buscar <span>→</span></button></form><div className="search-hint"><span>⌖</span> Explora servicios disponibles cerca de ti</div></div><div className="hero-art"><div className="art-note">Personas reales.<br /><strong>Trabajos bien hechos.</strong></div><div className="art-circle"><span>✦</span></div><div className="art-stat"><strong>+3.200</strong><small>prestadores activos</small></div></div></section>
    <main className="home-content"><section className="section-heading"><div><p className="eyebrow">TODO LO QUE BUSCAS</p><h2>Explora por categoría</h2></div><Link to="/buscar" className="text-link">Ver todas <span>→</span></Link></section><div className="category-grid">{categories.map((category) => <Link to={`/buscar?category=${category.name}`} className="category-tile" key={category.name}><span className="category-icon">{category.icon}</span><strong>{category.name}</strong><small>{category.count}</small><span className="tile-arrow">↗</span></Link>)}</div><section className="feature-band"><div><p className="eyebrow">PARA QUIENES HACEN</p><h2>Tu oficio merece<br /><em>ser encontrado.</em></h2><p>Publica tus servicios gratis y llega a personas que necesitan exactamente lo que tú sabes hacer.</p><Link to="/prestadores" className="dark-button">Quiero ofrecer mis servicios <span>→</span></Link></div><div className="feature-quote"><span>“</span><p>Encontré un electricista para mi mamá en menos de diez minutos.</p><small>— Camila, La Reina</small></div></section></main>
  </>
}

function SearchPage() {
  const params = new URLSearchParams(window.location.search)
  const [query, setQuery] = useState(params.get('q') || '')
  const [category, setCategory] = useState(params.get('category') || 'Todas')
  const [remoteServices, setRemoteServices] = useState(demoServices)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    getPublishedServices().then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        setLoadError('No pudimos cargar los servicios publicados. Mostramos ejemplos por ahora.')
      } else if (data?.length) {
        setRemoteServices(data.map((service) => ({ ...service, name: service.title, provider: service.provider_name, price: `$${Number(service.starting_price).toLocaleString('es-CL')}`, image: service.image_url || demoServices[0].image })))
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => remoteServices.filter((service) => (!query || `${service.name} ${service.category} ${service.location}`.toLowerCase().includes(query.toLowerCase())) && (category === 'Todas' || service.category === category)), [query, category, remoteServices])
  return <main className="results-page"><div className="results-intro"><p className="eyebrow">SERVICIOS CERCA DE TI</p><h1>Encuentra lo que necesitas.</h1><div className="compact-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busca por servicio, nombre o comuna" /><button aria-label="Buscar">→</button></div></div><div className="results-layout"><aside className="filters"><div className="filter-title"><strong>Filtrar resultados</strong><button onClick={() => { setQuery(''); setCategory('Todas') }}>Limpiar</button></div><label>Servicio o categoría<select value={category} onChange={(event) => setCategory(event.target.value)}><option>Todas</option>{categories.map((item) => <option key={item.name}>{item.name}</option>)}</select></label><label>Ubicación<div className="filter-input">⌖ <span>¿Dónde?</span></div></label><label>Precio referencial<div className="price-row"><input placeholder="Desde" /><input placeholder="Hasta" /></div></label><label className="check-label"><input type="checkbox" /> Solo disponibles</label></aside><section className="listing"><div className="listing-top"><span><strong>{loading ? '...' : filtered.length}</strong> servicios encontrados</span><select aria-label="Ordenar"><option>Más relevantes</option><option>Mejor evaluados</option><option>Precio menor</option></select></div>{loadError && <p className="data-notice">{loadError}</p>}{filtered.map((service) => <ServiceCard service={service} key={service.id} />)}{!loading && !filtered.length && <div className="empty-state"><strong>No encontramos resultados</strong><p>Prueba con otra categoría o término de búsqueda.</p></div>}<div className="pagination"><button className="active">1</button><button>2</button><button>3</button><span>...</span><button>8</button><button>→</button></div></section></div></main>
}

function ServiceCard({ service }) { return <article className="service-card"><img src={service.image} alt="" /><div className="service-card-body"><div className="card-top"><span className="category-label">{service.category}</span><button className="save-button" aria-label="Guardar servicio">♡</button></div><Link to={`/servicio/${service.id}`}><h2>{service.name}</h2></Link><p className="provider">{service.provider} <span className="verified">✓</span></p><div className="service-meta"><span>★ {service.rating}</span><span>⌖ {service.location}</span></div><div className="card-bottom"><span>Desde <strong>{service.price}</strong></span><Link to={`/servicio/${service.id}`} className="small-link">Ver servicio <span>→</span></Link></div></div></article> }

function ServiceDetail() { const { id } = useParams(); const service = services.find((item) => item.id === Number(id)) || services[0]; return <main className="detail-page"><Link to="/buscar" className="back-link">← Volver a resultados</Link><div className="detail-grid"><div><img className="detail-image" src={service.image} alt={service.name} /><div className="thumb-row"><img src={service.image} alt="" /><img src={service.image} alt="" /><span>+3 fotos</span></div></div><section className="detail-copy"><span className="category-label">{service.category}</span><h1>{service.name}</h1><p className="detail-provider">{service.provider} <span className="verified">✓</span></p><div className="detail-rating"><strong>★ {service.rating}</strong><span>24 reseñas</span><span>⌖ {service.location}</span></div><hr /><h3>Sobre este servicio</h3><p className="description">{service.description}</p><div className="contact-box"><div><strong>¿Te interesa este servicio?</strong><small>Responde normalmente en menos de una hora.</small></div><button className="dark-button">Contactar <span>→</span></button></div></section></div></main> }

function Providers() { return <main className="provider-page"><div className="provider-intro"><p className="eyebrow">PARA PRESTADORES</p><h1>Haz que tu oficio<br /><em>llegue más lejos.</em></h1><p>Ofrece tus servicios de forma gratuita y encuentra nuevos clientes en tu comuna.</p><button className="dark-button">Crear mi perfil <span>→</span></button></div><div className="provider-steps">{[['01', 'Crea tu perfil', 'Cuéntanos quién eres y qué sabes hacer.'], ['02', 'Publica tu servicio', 'Agrega tus fotos, precios y zonas de atención.'], ['03', 'Conecta con clientes', 'Recibe contactos de personas interesadas.']].map(([number, title, text]) => <div className="step" key={number}><span>{number}</span><h2>{title}</h2><p>{text}</p></div>)}</div></main> }

function App() { return <><Header /><Routes><Route path="/" element={<Home />} /><Route path="/buscar" element={<SearchPage />} /><Route path="/servicio/:id" element={<ServiceDetail />} /><Route path="/prestadores" element={<Providers />} /></Routes><footer><span>oficios <i>cerca</i></span><small>Una forma más humana de encontrar ayuda.</small><span>© 2026</span></footer></> }

export default App