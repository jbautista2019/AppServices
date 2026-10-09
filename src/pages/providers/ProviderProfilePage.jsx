import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Stars from '../../components/reviews/Stars'
import ServiceCard from '../../components/services/ServiceCard'
import { getProviderProfile, getProviderRatingSummary, getProviderServices, isSupabaseConfigured } from '../../utils/supabase'
import { whatsappUrl } from '../../utils/phone'

export default function ProviderProfilePage() {
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [services, setServices] = useState([])
  const [profile, setProfile] = useState(null)
  const [rating, setRating] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured || !id) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([getProviderServices(id), getProviderProfile(id), getProviderRatingSummary(id)]).then(([servicesResult, profileResult, ratingResult]) => {
      if (cancelled) return
      if (servicesResult.error) setError('No pudimos cargar los servicios de este profesional.')
      setServices(servicesResult.data || [])
      setProfile(profileResult.error ? null : profileResult.data)
      setRating(ratingResult.data)
      setLoading(false)
    }).catch(() => {
      if (cancelled) return
      setError('No pudimos cargar este perfil.')
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [id])

  const name = services[0]?.provider_name || 'Profesional'
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const whatsapp = whatsappUrl(profile?.phone, `Hola ${name}, vi tu perfil en Oficios Cerca y quisiera consultarte.`)

  if (loading) return <main className="provider-profile-page"><p>Cargando perfil...</p></main>
  if (error && !services.length) return <main className="provider-profile-page"><p role="alert">{error}</p></main>
  if (!services.length && !profile) return <main className="provider-profile-page"><p>Este profesional no tiene publicaciones disponibles.</p><Link to="/buscar">← Volver a buscar</Link></main>

  return <main className="provider-profile-page">
    <nav className="breadcrumb" aria-label="Ruta de navegación"><Link to="/">Inicio</Link><span aria-hidden="true">›</span><span aria-current="page">{name}</span></nav>
    <header className="provider-profile-header">
      <div className="account-avatar" aria-hidden="true">{initials}</div>
      <div className="provider-profile-identity">
        <h1>{name}</h1>
        {rating?.count ? <p className="provider-profile-rating"><Stars value={rating.average} size={16} /> <strong>{rating.average.toFixed(1)}</strong> · {rating.count} {rating.count === 1 ? 'valoración' : 'valoraciones'}</p> : <p className="provider-profile-rating">Aún sin valoraciones</p>}
        {profile?.bio && <p className="provider-profile-bio">{profile.bio}</p>}
        {whatsapp && <a className="provider-profile-whatsapp" href={whatsapp} target="_blank" rel="noopener noreferrer">Escribir por WhatsApp <span aria-hidden="true">→</span></a>}
      </div>
    </header>
    <section aria-labelledby="provider-services-title">
      <h2 id="provider-services-title">Servicios publicados ({services.length})</h2>
      {services.length ? <div className="listing-grid provider-profile-services">{services.map((service) => <ServiceCard service={service} key={service.id} />)}</div> : <p>No tiene servicios activos por ahora.</p>}
    </section>
  </main>
}
