import { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { getPublishedServices, isSupabaseConfigured } from './lib/supabase'

function Header() {
  return <header className="site-header"><Link to="/" className="brand"><span className="brand-mark">OC</span><span>oficios <i>cerca</i></span></Link><nav><Link to="/buscar">Explorar servicios</Link><Link to="/prestadores">Ofrece tus servicios</Link></nav><div className="header-actions"><button className="icon-button" aria-label="Notificaciones">♧</button><button className="user-button">Entrar <span>→</span></button></div></header>
}

function Home({ services, categories, loading }) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const submit = (event) => { event.preventDefault(); navigate(`/buscar${query ? `?q=${encodeURIComponent(query)}` : ''}`) }
  return <>
    <section className="hero"><div className="hero-copy"><p className="eyebrow">EL SERVICIO QUE NECESITAS, MÁS CERCA</p><h1>Encuentra a alguien que <em>lo haga bien.</em></h1><p className="hero-lead">Conecta con personas reales, recomendadas y disponibles para ayudarte en lo cotidiano.</p><form className="search-bar" onSubmit={submit}><span className="search-icon">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="¿Qué servicio estás buscando?" /><button type="submit">Buscar <span>→</span></button></form><div className="search-hint"><span>⌖</span> Explora servicios disponibles cerca de ti</div></div><div className="hero-art"><div className="art-note">Personas reales.<br /><strong>Trabajos bien hechos.</strong></div><div className="art-circle"><span>✦</span></div></div></section>
    <main className="home-content"><section className="section-heading"><div><p className="eyebrow">TODO LO QUE BUSCAS</p><h2>Explora por categoría</h2></div><Link to="/buscar" className="text-link">Ver todas <span>→</span></Link></section><div className="category-grid">{categories.map((category) => { const count = services.filter((service) => service.category === category).length; return <Link to={`/buscar?category=${encodeURIComponent(category)}`} className="category-tile" key={category}><span className="category-icon">✦</span><strong>{category}</strong><small>{count.toLocaleString('es-CL')} {count === 1 ? 'servicio' : 'servicios'}</small><span className="tile-arrow">↗</span></Link> })}{!loading && !categories.length && <p>No hay categorías publicadas todavía.</p>}{loading && !categories.length && <p>Cargando categorías...</p>}</div><section className="feature-band"><div><p className="eyebrow">PARA QUIENES HACEN</p><h2>Tu oficio merece<br /><em>ser encontrado.</em></h2><p>Publica tus servicios gratis y llega a personas que necesitan exactamente lo que tú sabes hacer.</p><Link to="/prestadores" className="dark-button">Quiero ofrecer mis servicios <span>→</span></Link></div><div className="feature-quote"><span>“</span><p>Encontré un electricista para mi mamá en menos de diez minutos.</p><small>— Camila, La Reina</small></div></section></main>
  </>
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
              {categories.map((item) => <option key={item}>{item}</option>)}
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

function App() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [loadError, setLoadError] = useState(isSupabaseConfigured ? '' : 'Configura Supabase para cargar publicaciones.')

  useEffect(() => {
    if (!isSupabaseConfigured) return

    let cancelled = false
    getPublishedServices().then(({ data, error }) => {
      if (cancelled) return
      if (error) setLoadError('No pudimos cargar las publicaciones desde Supabase.')
      else setServices(data || [])
      setLoading(false)
    }).catch(() => {
      if (cancelled) return
      setLoadError('No pudimos conectar con Supabase.')
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [])

  const categories = [...new Set(services.map((service) => service.category).filter(Boolean))]

  return <><Header /><Routes><Route path="/" element={<Home services={services} categories={categories} loading={loading} />} /><Route path="/buscar" element={<SearchPage services={services} categories={categories} loading={loading} loadError={loadError} />} /><Route path="/servicio/:id" element={<ServiceDetail services={services} loading={loading} loadError={loadError} />} /><Route path="/prestadores" element={<Providers />} /></Routes><footer><span>oficios <i>cerca</i></span><small>Una forma más humana de encontrar ayuda.</small><span>© 2026</span></footer></>
}

export default App