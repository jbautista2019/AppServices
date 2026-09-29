import { Link } from 'react-router-dom'

function formatPrice(amount) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount)
}

export default function ServiceCard({ service }) {
  return <article className="service-card">{service.image_url && <img src={service.image_url} alt="" />}<div className="service-card-body"><div className="card-top"><span className="category-label">{service.category}</span><button className="save-button" aria-label="Guardar servicio">♡</button></div><Link to={`/servicio/${service.id}`}><h2>{service.title}</h2></Link><p className="provider">{service.provider_name} <span className="verified">✓</span></p><div className="service-meta"><span>★ {Number(service.rating).toFixed(1)}</span><span>⌖ {service.location}</span></div><div className="card-bottom"><span>Desde <strong>{formatPrice(service.starting_price)}</strong></span><Link to={`/servicio/${service.id}`} className="small-link">Ver servicio <span>→</span></Link></div></div></article>
}