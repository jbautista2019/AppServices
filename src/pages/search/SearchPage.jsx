import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import CommuneInput from '../../components/common/CommuneInput'
import ServiceCard from '../../components/services/ServiceCard'
import { semanticSearch } from '../../utils/supabase'

const SERVICES_PER_PAGE = 6

function parsePriceFilter(value) {
  const digits = String(value).replace(/\D/g, '')
  return digits ? Number(digits) : null
}

function normalizeText(text) {
  return String(text || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export default function SearchPage({ services, categories, loading, loadError, embedded = false }) {
  const params = new URLSearchParams(window.location.search)
  const [urlParams, setUrlParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') || '')
  const [category, setCategory] = useState(params.get('category') || 'Todas')
  const [location, setLocation] = useState(params.get('location') || '')
  const [minimumPrice, setMinimumPrice] = useState('')
  const [maximumPrice, setMaximumPrice] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState('relevance')
  const urlKey = urlParams.toString()
  // Resultado de la búsqueda híbrida para la consulta activa (null = no hay consulta o falló el servicio).
  const [ranking, setRanking] = useState(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const term = query.trim()
    setRanking(null)
    if (embedded || !term) {
      setSearching(false)
      return
    }

    let cancelled = false
    setSearching(true)
    const timer = setTimeout(() => {
      semanticSearch(term).then(({ data, error }) => {
        if (cancelled) return
        setRanking(error || !data ? null : new Map(data.map((result) => [String(result.id), result])))
        setSearching(false)
      })
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, embedded])

  // Mantiene los filtros sincronizados cuando la búsqueda cambia desde el header estando ya en /buscar.
  useEffect(() => {
    if (embedded) return
    setQuery(urlParams.get('q') || '')
    setCategory(urlParams.get('category') || 'Todas')
    setLocation(urlParams.get('location') || '')
    setCurrentPage(1)
  }, [urlKey, embedded])
  const filtered = useMemo(() => {
    const locationQuery = location.trim().toLocaleLowerCase('es-CL')

    const fallbackQuery = normalizeText(query).trim()

    const matches = services.filter((service) => {
      // Con ranking híbrido manda la relevancia del servidor; si no está disponible se usa coincidencia de texto sin tildes.
      const matchesQuery = !fallbackQuery || (ranking
        ? ranking.has(String(service.id))
        : normalizeText(`${service.title} ${service.provider_name} ${service.category} ${service.location}`).includes(fallbackQuery))
      const matchesCategory = category === 'Todas' || service.category === category
      const matchesLocation = !locationQuery || (service.location || '').toLocaleLowerCase('es-CL').includes(locationQuery)
      const price = Number(service.starting_price)
      const minimum = parsePriceFilter(minimumPrice)
      const maximum = parsePriceFilter(maximumPrice)
      const matchesMinimumPrice = minimum === null || (Number.isFinite(price) && price >= minimum)
      const matchesMaximumPrice = maximum === null || (Number.isFinite(price) && price <= maximum)

      return matchesQuery && matchesCategory && matchesLocation && matchesMinimumPrice && matchesMaximumPrice
    })

    const byRating = (first, second) => Number(second.rating) - Number(first.rating)
    const byPrice = (first, second) => Number(first.starting_price) - Number(second.starting_price)
    if (sortBy === 'rating') return matches.sort(byRating)
    if (sortBy === 'price-asc') return matches.sort(byPrice)
    if (sortBy === 'price-desc') return matches.sort((first, second) => byPrice(second, first))
    // «Más recientes» y «Más relevantes» sin consulta conservan el orden de carga (más nuevas primero).
    if (sortBy === 'recent' || !ranking) return matches
    return matches.sort((first, second) => ranking.get(String(second.id)).score - ranking.get(String(first.id)).score)
  }, [query, category, location, minimumPrice, maximumPrice, services, ranking, sortBy])
  const pageCount = Math.ceil(filtered.length / SERVICES_PER_PAGE)
  const visibleServices = filtered.slice((currentPage - 1) * SERVICES_PER_PAGE, currentPage * SERVICES_PER_PAGE)
  const PageWrapper = embedded ? 'div' : 'main'

  return (
    <PageWrapper className={`results-page${embedded ? ' results-page--embedded' : ''}`}>
      <div className="results-layout">
        <aside className="filters">
          <div className="filter-title">
            <strong>Filtrar resultados</strong>
            <button onClick={() => { setQuery(''); setCategory('Todas'); setLocation(''); setMinimumPrice(''); setMaximumPrice(''); setCurrentPage(1); setSortBy('relevance'); if (!embedded) setUrlParams({}) }}>Limpiar</button>
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
            <CommuneInput className="filter-input" aria-label="Filtrar por ubicación" placeholder="Comuna o ciudad" value={location} onChange={(value) => { setLocation(value); setCurrentPage(1) }} />
          </label>
          <label>
            Precio referencial
            <div className="price-row">
              <input type="text" inputMode="decimal" aria-label="Precio mínimo" placeholder="Desde" value={minimumPrice} onChange={(event) => { setMinimumPrice(event.target.value); setCurrentPage(1) }} />
              <input type="text" inputMode="decimal" aria-label="Precio máximo" placeholder="Hasta" value={maximumPrice} onChange={(event) => { setMaximumPrice(event.target.value); setCurrentPage(1) }} />
            </div>
          </label>
        </aside>
        <section className="listing">
          <div className="listing-top">
            <span><strong>{loading || searching ? '...' : filtered.length}</strong> servicios encontrados{ranking && !searching && sortBy === 'relevance' && <small className="listing-relevance"> · ordenados por relevancia</small>}</span>
            <select aria-label="Ordenar" value={sortBy} onChange={(event) => { setSortBy(event.target.value); setCurrentPage(1) }}>
              <option value="relevance">Más relevantes</option>
              <option value="recent">Más recientes</option>
              <option value="rating">Mejor evaluados</option>
              <option value="price-asc">Precio: menor a mayor</option>
              <option value="price-desc">Precio: mayor a menor</option>
            </select>
          </div>
          {loadError && <p className="data-notice">{loadError}</p>}
          {searching && <p className="data-notice" role="status">Buscando...</p>}
          {!searching && visibleServices.map((service) => <ServiceCard service={service} key={service.id} related={Boolean(ranking) && !ranking.get(String(service.id))?.text} />)}
          {!loading && !searching && !filtered.length && <div className="empty-state"><strong>No encontramos publicaciones</strong><p>Cuando haya servicios activos en Supabase, aparecerán aquí.</p></div>}
          {pageCount > 1 && <nav className="pagination" aria-label="Paginación de servicios"><button type="button" aria-label="Página anterior" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>←</button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => <button type="button" key={page} className={currentPage === page ? 'active' : ''} aria-current={currentPage === page ? 'page' : undefined} onClick={() => setCurrentPage(page)}>{page}</button>)}<button type="button" aria-label="Página siguiente" onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))} disabled={currentPage === pageCount}>→</button></nav>}
        </section>
      </div>
    </PageWrapper>
  )
}