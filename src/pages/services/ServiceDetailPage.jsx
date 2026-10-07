import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import CommuneInput from '../../components/common/CommuneInput'
import ImagePicker from '../../components/services/ImagePicker'
import Stars from '../../components/reviews/Stars'
import { ModalityBadges, ServiceModalityField } from '../../components/services/ServiceModality'
import { getOrCreateConversation, getServiceById, getServiceReviews, isSupabaseConfigured, refreshServiceEmbedding, supabase, updateService, uploadServiceImage } from '../../utils/supabase'

export default function ServiceDetailPage({ services, loading, loadError }) {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const isEditing = location.pathname.endsWith('/editar')

  const [session, setSession] = useState(null)
  const [detailService, setDetailService] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeType, setNoticeType] = useState('info')
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    location: '',
    starting_price: '',
    description: '',
    image_url: '',
    offers_local: true,
    offers_home: false,
  })
  const [imageFile, setImageFile] = useState(null)
  const [imageRemoved, setImageRemoved] = useState(false)

  const listedService = services.find((item) => String(item.id) === id)
  const [fetchedService, setFetchedService] = useState(null)
  const [reviews, setReviews] = useState([])
  const [fetchedLoading, setFetchedLoading] = useState(false)
  const service = isEditing ? detailService : listedService || (fetchedService && String(fetchedService.id) === id ? fetchedService : null)

  // Una publicación recién creada puede no estar aún en la lista cargada al inicio: se consulta directamente.
  useEffect(() => {
    if (isEditing || !id || loading || listedService || !supabase) return

    let cancelled = false
    setFetchedLoading(true)
    getServiceById(id).then(({ data, error }) => {
      if (cancelled) return
      if (!error && data) setFetchedService(data)
      setFetchedLoading(false)
    }).catch(() => {
      if (!cancelled) setFetchedLoading(false)
    })

    return () => { cancelled = true }
  }, [id, isEditing, loading, Boolean(listedService)])

  useEffect(() => {
    if (!supabase) return

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => setSession(currentSession))

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!isEditing || !id) return

    let cancelled = false

    setDetailLoading(true)
    getServiceById(id).then(({ data, error }) => {
      if (cancelled) return

      if (!error && data) {
        setDetailService(data)
        setFormData({
          title: data.title || '',
          category: data.category || '',
          location: data.location || '',
          starting_price: data.starting_price ?? '',
          offers_local: data.offers_local !== false,
          offers_home: data.offers_home === true,
          description: data.description || '',
          image_url: data.image_url || '',
        })
      }

      setDetailLoading(false)
    }).catch(() => {
      if (!cancelled) setDetailLoading(false)
    })

    return () => { cancelled = true }
  }, [id, isEditing])

  useEffect(() => {
    if (isEditing || !id) return

    let cancelled = false
    getServiceReviews(id).then(({ data, error }) => {
      if (!cancelled && !error) setReviews(data || [])
    }).catch(() => {})

    return () => { cancelled = true }
  }, [id, isEditing])

  const isOwner = Boolean(session?.user?.id && detailService && String(detailService.provider_id) === String(session.user.id))
  const ownsPublishedService = Boolean(session?.user?.id && service?.provider_id && String(service.provider_id) === String(session.user.id))

  async function handleContact() {
    if (!session) {
      navigate('/cuenta', { state: { backgroundLocation: location } })
      return
    }

    if (!service?.provider_id) {
      setNoticeType('error')
      setNotice('Esta publicación no está vinculada a una cuenta profesional.')
      return
    }

    if (ownsPublishedService) {
      setNoticeType('error')
      setNotice('No puedes iniciar una conversación con tu propia publicación.')
      return
    }

    setSaving(true)
    setNotice('')
    try {
      const clientName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Cliente'
      const { data, error } = await getOrCreateConversation({
        service_id: service.id,
        client_id: session.user.id,
        provider_id: service.provider_id,
        service_title: service.title,
        provider_name: service.provider_name,
        client_name: clientName,
      })
      if (error || !data) throw error || new Error('No se pudo iniciar la conversación.')
      navigate(`/mensajes?conversation=${encodeURIComponent(data.id)}`)
    } catch (error) {
      setNoticeType('error')
      setNotice(error.message || 'No se pudo iniciar el chat. Verifica que el módulo de mensajería esté habilitado en Supabase.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!detailService || !isOwner || !supabase) return

    setSaving(true)
    setNotice('')

    try {
      let imageUrl = imageRemoved ? null : formData.image_url.trim() || null
      if (imageFile) {
        const { url, error: uploadError } = await uploadServiceImage(imageFile, session.user.id)
        if (uploadError) throw uploadError
        imageUrl = url
      }

      const payload = {
        title: formData.title.trim(),
        category: formData.category.trim(),
        location: formData.location.trim(),
        starting_price: Number(formData.starting_price) || 0,
        offers_local: formData.offers_local,
        offers_home: formData.offers_home,
        description: formData.description.trim(),
        image_url: imageUrl,
      }

      if (!payload.offers_local && !payload.offers_home) {
        throw new Error('Selecciona al menos una modalidad de atención: en local o a domicilio.')
      }

      if (!payload.title || !payload.category || !payload.location) {
        throw new Error('Completa los campos obligatorios.')
      }

      const { error } = await updateService(detailService.id, session.user.id, payload)
      if (error) throw error

      refreshServiceEmbedding(detailService.id)
      navigate('/mis-servicios', { replace: true, state: { refreshServices: true } })
    } catch (error) {
      setNoticeType('error')
      setNotice(error.message || 'No pudimos actualizar el servicio.')
    } finally {
      setSaving(false)
    }
  }

  if (loading || detailLoading || fetchedLoading) return <main className="detail-page"><p>Cargando publicación...</p></main>

  if (isEditing) {
    if (!isSupabaseConfigured) {
      return <main className="detail-page"><Link to="/mis-servicios" className="back-link">← Volver a mis servicios</Link><p>Configura Supabase para editar servicios.</p></main>
    }

    if (!detailService) {
      return <main className="detail-page"><Link to="/mis-servicios" className="back-link">← Volver a mis servicios</Link><p>No se encontró este servicio para editar.</p></main>
    }

    if (!isOwner) {
      return <main className="detail-page"><Link to="/mis-servicios" className="back-link">← Volver a mis servicios</Link><p>No puedes editar este servicio porque no te pertenece.</p></main>
    }

    return <main className="detail-page create-service-page">
      <Link to="/mis-servicios" className="back-link">← Volver al perfil</Link>
      <section className="create-service-panel">
        <header className="create-service-heading">
          <p className="eyebrow">TU PUBLICACIÓN</p>
          <h1>Editar servicio</h1>
        </header>
        <form className="account-form create-service-form service-form" onSubmit={handleSubmit}>
          <label className="field-wide">Título<input required maxLength={120} value={formData.title} onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))} /></label>
          <label>Categoría<input required value={formData.category} onChange={(event) => setFormData((current) => ({ ...current, category: event.target.value }))} /></label>
          <label>Ubicación<CommuneInput required maxLength={120} value={formData.location} onChange={(value) => setFormData((current) => ({ ...current, location: value }))} placeholder="Escribe tu comuna" /></label>
          <label>Precio base<input type="number" min="0" step="1000" value={formData.starting_price} onChange={(event) => setFormData((current) => ({ ...current, starting_price: event.target.value }))} /></label>
          <ImagePicker currentUrl={formData.image_url} file={imageFile} removed={imageRemoved} onChange={(file) => { setImageFile(file); if (file) setImageRemoved(false) }} onRemoveCurrent={() => setImageRemoved(true)} />
          <ServiceModalityField offersLocal={formData.offers_local} offersHome={formData.offers_home} onChange={({ offersLocal, offersHome }) => setFormData((current) => ({ ...current, offers_local: offersLocal, offers_home: offersHome }))} />
          <label className="field-wide">Descripción<textarea rows="4" required maxLength={4000} value={formData.description} onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))} /></label>
          {notice && <p className={`account-notice account-notice--${noticeType} field-wide`} role={noticeType === 'error' ? 'alert' : 'status'}>{notice}</p>}
          <div className="create-service-actions field-wide">
            <Link to="/mis-servicios">Cancelar</Link>
            <button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
          </div>
        </form>
      </section>
    </main>
  }

  if (!service) return <main className="detail-page"><Link to="/buscar" className="back-link">← Volver a resultados</Link><p>{loadError || 'Esta publicación no está disponible.'}</p></main>

  return <main className="detail-page"><nav className="breadcrumb" aria-label="Ruta de navegación"><Link to="/">Inicio</Link><span aria-hidden="true">›</span><Link to={`/buscar?category=${encodeURIComponent(service.category)}`}>{service.category}</Link><span aria-hidden="true">›</span><span aria-current="page">{service.title}</span></nav><div className="detail-grid"><div>{service.image_url && <img className="detail-image" src={service.image_url} alt={service.title} />}</div><section className="detail-copy"><span className="category-label">{service.category}</span><h1>{service.title}</h1><p className="detail-provider">{service.provider_name} <span className="verified">✓</span></p><div className="detail-rating"><strong>★ {Number(service.rating).toFixed(1)}{reviews.length > 0 && <small> ({reviews.length})</small>}</strong><span>⌖ {service.location}</span><ModalityBadges service={service} /></div><hr /><h3>Sobre este servicio</h3><p className="description">{service.description}</p>{!ownsPublishedService && <div className="contact-box"><div><strong>¿Te interesa este servicio?</strong><small>Responde normalmente en menos de una hora.</small>{notice && <small className="contact-notice" role="alert">{notice}</small>}</div><button className="dark-button" type="button" disabled={saving} onClick={handleContact}>{saving ? 'Abriendo chat...' : 'Contactar'} <span aria-hidden="true">→</span></button></div>}</section></div>
    <section className="reviews-section" aria-labelledby="reviews-title">
      <h2 id="reviews-title">Valoraciones{reviews.length > 0 && <small> · {reviews.length}</small>}</h2>
      {reviews.length ? <ul className="reviews-list">{reviews.map((review) => <li key={review.id}>
        <div className="reviews-list-top"><strong>{review.reviewer_name}</strong><Stars value={review.rating} size={14} /><time dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString('es-CL')}</time></div>
        {review.comment && <p>{review.comment}</p>}
      </li>)}</ul> : <p className="reviews-empty">Este servicio aún no tiene valoraciones.</p>}
    </section></main>
}