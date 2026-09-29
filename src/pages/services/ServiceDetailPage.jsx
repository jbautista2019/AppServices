import { Link, useParams } from 'react-router-dom'

export default function ServiceDetailPage({ services, loading, loadError }) {
  const { id } = useParams()
  const service = services.find((item) => String(item.id) === id)

  if (loading) return <main className="detail-page"><p>Cargando publicación...</p></main>
  if (!service) return <main className="detail-page"><Link to="/buscar" className="back-link">← Volver a resultados</Link><p>{loadError || 'Esta publicación no está disponible.'}</p></main>

  return <main className="detail-page"><Link to="/buscar" className="back-link">← Volver a resultados</Link><div className="detail-grid"><div>{service.image_url && <img className="detail-image" src={service.image_url} alt={service.title} />}</div><section className="detail-copy"><span className="category-label">{service.category}</span><h1>{service.title}</h1><p className="detail-provider">{service.provider_name} <span className="verified">✓</span></p><div className="detail-rating"><strong>★ {Number(service.rating).toFixed(1)}</strong><span>⌖ {service.location}</span></div><hr /><h3>Sobre este servicio</h3><p className="description">{service.description}</p><div className="contact-box"><div><strong>¿Te interesa este servicio?</strong><small>Responde normalmente en menos de una hora.</small></div><button className="dark-button">Contactar <span>→</span></button></div></section></div></main>
}