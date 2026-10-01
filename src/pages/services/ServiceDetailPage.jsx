import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { getServiceById, isSupabaseConfigured, supabase, updateService } from '../../utils/supabase'

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
  })

  const service = isEditing ? detailService : services.find((item) => String(item.id) === id)

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

  const isOwner = Boolean(session?.user?.id && detailService && String(detailService.provider_id) === String(session.user.id))

  async function handleSubmit(event) {
    event.preventDefault()
    if (!detailService || !isOwner || !supabase) return

    setSaving(true)
    setNotice('')

    try {
      const payload = {
        title: formData.title.trim(),
        category: formData.category.trim(),
        location: formData.location.trim(),
        starting_price: Number(formData.starting_price) || 0,
        description: formData.description.trim(),
        image_url: formData.image_url.trim() || null,
      }

      if (!payload.title || !payload.category || !payload.location) {
        throw new Error('Completa los campos obligatorios.')
      }

      const { error } = await updateService(detailService.id, session.user.id, payload)
      if (error) throw error

      navigate('/perfil', { replace: true, state: { profileSection: 'services' } })
    } catch (error) {
      setNoticeType('error')
      setNotice(error.message || 'No pudimos actualizar el servicio.')
    } finally {
      setSaving(false)
    }
  }

  if (loading || detailLoading) return <main className="detail-page"><p>Cargando publicación...</p></main>

  if (isEditing) {
    if (!isSupabaseConfigured) {
      return <main className="detail-page"><Link to="/perfil" className="back-link">← Volver al perfil</Link><p>Configura Supabase para editar servicios.</p></main>
    }

    if (!detailService) {
      return <main className="detail-page"><Link to="/perfil" className="back-link">← Volver al perfil</Link><p>No se encontró este servicio para editar.</p></main>
    }

    if (!isOwner) {
      return <main className="detail-page"><Link to="/perfil" className="back-link">← Volver al perfil</Link><p>No puedes editar este servicio porque no te pertenece.</p></main>
    }

    return <main className="detail-page">
      <Link to="/perfil" className="back-link">← Volver al perfil</Link>
      <div className="account-panel" style={{ maxWidth: '720px', margin: '24px auto 0' }}>
        <h2 style={{ marginBottom: '20px' }}>Editar servicio</h2>
        <form className="account-form" onSubmit={handleSubmit}>
          <label>Título<input required value={formData.title} onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))} /></label>
          <label>Categoría<input required value={formData.category} onChange={(event) => setFormData((current) => ({ ...current, category: event.target.value }))} /></label>
          <label>Ubicación<input required value={formData.location} onChange={(event) => setFormData((current) => ({ ...current, location: event.target.value }))} /></label>
          <label>Precio base<input type="number" min="0" step="1000" value={formData.starting_price} onChange={(event) => setFormData((current) => ({ ...current, starting_price: event.target.value }))} /></label>
          <label>URL de imagen<input value={formData.image_url} onChange={(event) => setFormData((current) => ({ ...current, image_url: event.target.value }))} /></label>
          <label>Descripción<textarea rows="6" required value={formData.description} onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))} /></label>
          {notice && <p className={`account-notice account-notice--${noticeType}`} role={noticeType === 'error' ? 'alert' : 'status'}>{notice}</p>}
          <button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
        </form>
      </div>
    </main>
  }

  if (!service) return <main className="detail-page"><Link to="/buscar" className="back-link">← Volver a resultados</Link><p>{loadError || 'Esta publicación no está disponible.'}</p></main>

  return <main className="detail-page"><Link to="/buscar" className="back-link">← Volver a resultados</Link><div className="detail-grid"><div>{service.image_url && <img className="detail-image" src={service.image_url} alt={service.title} />}</div><section className="detail-copy"><span className="category-label">{service.category}</span><h1>{service.title}</h1><p className="detail-provider">{service.provider_name} <span className="verified">✓</span></p><div className="detail-rating"><strong>★ {Number(service.rating).toFixed(1)}</strong><span>⌖ {service.location}</span></div><hr /><h3>Sobre este servicio</h3><p className="description">{service.description}</p><div className="contact-box"><div><strong>¿Te interesa este servicio?</strong><small>Responde normalmente en menos de una hora.</small></div><button className="dark-button">Contactar <span>→</span></button></div></section></div></main>
}