import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const CATEGORY_IMAGES = [
  'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=700&q=82',
  'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=700&q=82',
  'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=700&q=82',
  'https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&w=700&q=82',
  'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=700&q=82',
  'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=700&q=82',
]

// Imagen por defecto según el nombre de la categoría (si no tiene una propia); evita repetir fotos al haber más de 6 categorías.
const CATEGORY_IMAGE_BY_NAME = {
  jardineria: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=700&q=82',
}

function normalizeName(name) {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

function categoryImage(category, index) {
  return category.image_url || CATEGORY_IMAGE_BY_NAME[normalizeName(category.name)] || CATEGORY_IMAGES[index % CATEGORY_IMAGES.length]
}

const LOCATIONS = ['Santiago', 'Providencia', 'Las Condes', 'Ñuñoa', 'Maipú', 'La Florida']

export default function HomePage({ services, categories, loading }) {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('Santiago')
  const navigate = useNavigate()
  const carouselRef = useRef(null)
  const featuredServices = [...services].sort((first, second) => Number(second.rating) - Number(first.rating)).slice(0, 8)

  function submit(event) {
    event.preventDefault()
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (location) params.set('location', location)
    navigate(`/buscar${params.size ? `?${params}` : ''}`)
  }

  function scrollProfessionals(direction) {
    carouselRef.current?.scrollBy({ left: direction * 270, behavior: 'smooth' })
  }

  return <>
    <main className="home-page">
      <section className="home-hero" id="inicio">
        <div className="home-hero-inner">
          <div className="home-search-column">
            <p className="home-eyebrow">PROFESIONALES DE CONFIANZA, CERCA DE TI</p>
            <h1>Encuentra al profesional que necesitas, <span>en un solo lugar.</span></h1>
            <p className="home-lead">Gasfíteres, maestros de obra, carpinteros y especialistas listos para ayudarte.</p>
            <form className="home-search" onSubmit={submit}>
              <label className="home-search-query"><span aria-hidden="true">⌕</span><span className="home-search-input"><small>¿Qué servicio necesitas?</small><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ej: gasfíter, electricista, carpintero" /></span></label>
              <label className="home-search-location"><span aria-hidden="true">⌖</span><span><small>Ubicación</small><select value={location} onChange={(event) => setLocation(event.target.value)}><option value="">Todas las zonas</option>{LOCATIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></span></label>
              <button type="submit"><span aria-hidden="true">⌕</span> Buscar</button>
            </form>
          </div>
          <section className="home-categories" id="categorias" aria-labelledby="categories-title">
            <div className="home-section-heading home-category-heading"><h2 id="categories-title">Categorías de servicios</h2><Link to="/buscar">Ver todas <span aria-hidden="true">→</span></Link></div>
            <div className="home-category-grid">
              {categories.map((category, index) => {
                return <Link to={`/buscar?category=${encodeURIComponent(category.name)}`} className="home-category-card" key={category.name}>
                  <img src={categoryImage(category, index)} alt="" loading={index > 2 ? 'lazy' : 'eager'} />
                  <strong>{category.name}</strong>
                </Link>
              })}
              {loading && !categories.length && Array.from({ length: 6 }, (_, index) => <div className="home-category-skeleton" key={index} />)}
              {!loading && !categories.length && <p className="home-empty-categories">Aún no hay categorías publicadas.</p>}
            </div>
          </section>
        </div>
      </section>

      <section className="home-professionals" aria-labelledby="professionals-title">
        <div className="home-section-heading">
          <h2 id="professionals-title"><span aria-hidden="true">✦</span> Profesionales más buscados</h2>
          <div className="home-carousel-actions">
            <Link to="/buscar">Ver todos los profesionales <span aria-hidden="true">→</span></Link>
            <button type="button" aria-label="Desplazar profesionales a la izquierda" onClick={() => scrollProfessionals(-1)}>‹</button>
            <button type="button" aria-label="Desplazar profesionales a la derecha" onClick={() => scrollProfessionals(1)}>›</button>
          </div>
        </div>
        <div className="home-professional-list" ref={carouselRef}>
          {featuredServices.map((service, index) => <article className="home-professional-card" key={service.id}>
            <Link to={`/servicio/${service.id}`} className="home-professional-image">
              <img src={service.image_url || CATEGORY_IMAGES[index % CATEGORY_IMAGES.length]} alt="" loading={index > 2 ? 'lazy' : 'eager'} />
              {Number(service.rating) >= 4.8 && <span className="home-featured-badge">Destacado</span>}
            </Link>
            <div className="home-professional-body">
              <Link to={`/servicio/${service.id}`} className="home-professional-name">{service.provider_name}</Link>
              <span className="home-professional-category">{service.category}</span>
              <span className="home-professional-rating"><b>★</b> {Number(service.rating).toFixed(1)} <span>·</span> {service.location}</span>
              <p>{service.title.replace(/^\[PRUEBA\]\s*/i, '')}</p>
              <Link className="home-contact-button" to={`/servicio/${service.id}`}>Ver servicio <span aria-hidden="true">→</span></Link>
            </div>
          </article>)}
          {!loading && !featuredServices.length && <p className="home-empty-services">Todavía no hay profesionales publicados.</p>}
          {loading && !featuredServices.length && <p className="home-empty-services">Cargando profesionales...</p>}
        </div>
      </section>

      <section className="home-provider-banner" id="profesionales">
        <div className="home-provider-copy">
          <span className="home-provider-icon" aria-hidden="true">✣</span>
          <div><h2>¿Eres un profesional?</h2><p>Publica tus servicios y llega a más clientes en tu zona.</p><Link to="/prestadores">Regístrate ahora <span aria-hidden="true">→</span></Link></div>
        </div>
        <ul className="home-provider-benefits"><li>Crea tu perfil en minutos</li><li>Recibe solicitudes de clientes</li><li>Destaca con el sello de verificado</li><li>Gestiona tus servicios fácilmente</li></ul>
        <div className="home-provider-image" role="img" aria-label="Vista de Santiago y la cordillera" />
      </section>
    </main>
  </>
}