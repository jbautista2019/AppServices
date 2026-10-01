import { useMemo, useState } from 'react'
import ServiceCard from '../../components/services/ServiceCard'

const SERVICES_PER_PAGE = 6

export default function SearchPage({ services, categories, loading, loadError, embedded = false }) {
  const params = new URLSearchParams(window.location.search)
  const [query, setQuery] = useState(params.get('q') || '')
  const [category, setCategory] = useState(params.get('category') || 'Todas')
  const [location, setLocation] = useState(params.get('location') || '')
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
  const PageWrapper = embedded ? 'div' : 'main'

  return (
    <PageWrapper className={`results-page${embedded ? ' results-page--embedded' : ''}`}>
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
              {categories.map((item) => <option key={item.name}>{item.name}</option>)}
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
    </PageWrapper>
  )
}