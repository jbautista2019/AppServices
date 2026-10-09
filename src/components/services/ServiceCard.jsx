import { Link } from 'react-router-dom'
import { isPremium } from '../../utils/featured'
import FavoriteButton from './FavoriteButton'
import { ModalityBadges } from './ServiceModality'

function formatPrice(amount) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount)
}

export default function ServiceCard({ service, related = false }) {
  return <article className="service-card">{service.image_url && <Link to={`/servicio/${service.id}`} className="service-card-image" aria-label={`Ver ${service.title}`} tabIndex={-1}><img src={service.image_url} alt="" /></Link>}<div className="service-card-body"><div className="card-top"><span className="category-label">{service.category}</span>{isPremium(service) && <span className="premium-badge" title="Publicación premium">★ Premium</span>}{related && <span className="related-badge" title="Coincide por significado con tu búsqueda">Relacionado</span>}<FavoriteButton service={service} /></div><Link to={`/servicio/${service.id}`}><h2>{service.title}</h2></Link><p className="provider">{service.provider_name} <span className="verified">✓</span></p><div className="service-meta"><span>★ {Number(service.rating).toFixed(1)}</span><span>⌖ {service.location}</span><ModalityBadges service={service} /></div><div className="card-bottom"><span>Desde <strong>{formatPrice(service.starting_price)}</strong></span><Link to={`/servicio/${service.id}`} className="small-link">Ver servicio <span>→</span></Link></div></div></article>
}