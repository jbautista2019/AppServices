import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import CommuneInput from '../../components/common/CommuneInput'
import ImagePicker from '../../components/services/ImagePicker'
import { ServiceModalityField } from '../../components/services/ServiceModality'
import { createService, isSupabaseConfigured, supabase, uploadServiceImage } from '../../utils/supabase'

export default function CreateServicePage({ categories }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: '',
    category: '',
    location: '',
    startingPrice: '',
    description: '',
    offersLocal: true,
    offersHome: false,
  })
  const [imageFile, setImageFile] = useState(null)

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }

    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!session || !supabase) return
    if (!form.offersLocal && !form.offersHome) {
      setError('Selecciona al menos una modalidad de atención: en local o a domicilio.')
      return
    }

    setSaving(true)
    setError('')
    const providerName = session.user.user_metadata?.full_name
      || session.user.user_metadata?.name
      || session.user.email?.split('@')[0]
      || 'Profesional'

    let imageUrl = null
    if (imageFile) {
      const { url, error: uploadError } = await uploadServiceImage(imageFile, session.user.id)
      if (uploadError) {
        setError(uploadError.message)
        setSaving(false)
        return
      }
      imageUrl = url
    }

    const { error: saveError } = await createService({
      provider_id: session.user.id,
      provider_name: providerName,
      title: form.title.trim(),
      category: form.category,
      location: form.location.trim(),
      rating: 0,
      starting_price: Math.max(0, Math.round(Number(form.startingPrice) || 0)),
      image_url: imageUrl,
      description: form.description.trim(),
      offers_local: form.offersLocal,
      offers_home: form.offersHome,
      is_active: true,
    })

    if (saveError) {
      setError('No se pudo publicar el servicio. Revisa los datos e inténtalo nuevamente.')
      setSaving(false)
      return
    }

    navigate('/mis-servicios', { replace: true, state: { refreshServices: true } })
  }

  if (authLoading) return <main className="detail-page"><p>Comprobando sesión...</p></main>

  if (!isSupabaseConfigured) return <main className="detail-page"><Link to="/mis-servicios" className="back-link">← Volver a mis servicios</Link><p>Configura Supabase para publicar servicios.</p></main>

  if (!session) return <main className="detail-page"><Link to="/mis-servicios" className="back-link">← Volver a mis servicios</Link><div className="create-service-notice"><p>Inicia sesión para crear una publicación.</p><Link to="/cuenta" state={{ backgroundLocation: location }}>Iniciar sesión <span aria-hidden="true">→</span></Link></div></main>

  return <main className="detail-page create-service-page">
    <Link to="/mis-servicios" className="back-link">← Volver a mis servicios</Link>
    <section className="create-service-panel">
      <header className="create-service-heading">
        <p className="eyebrow">PUBLICA TU OFICIO</p>
        <h1>Crear servicio</h1>
        <p>Cuéntales a tus futuros clientes qué ofreces.</p>
      </header>
      <form className="account-form create-service-form service-form" onSubmit={handleSubmit}>
        <label className="field-wide">Título del servicio<input required maxLength={120} value={form.title} onChange={(event) => updateField('title', event.target.value)} placeholder="Ej. Reparación de grifería" /></label>
        <label>Categoría<select required value={form.category} onChange={(event) => updateField('category', event.target.value)}>
          <option value="">Selecciona una categoría</option>
          {categories.map((category) => <option key={category.name} value={category.name}>{category.name}</option>)}
        </select></label>
        <label>Ubicación<CommuneInput required maxLength={120} value={form.location} onChange={(value) => updateField('location', value)} placeholder="Escribe tu comuna" /></label>
        <label>Precio referencial<input type="number" min="0" step="1000" value={form.startingPrice} onChange={(event) => updateField('startingPrice', event.target.value)} placeholder="Desde" /></label>
        <ImagePicker file={imageFile} onChange={setImageFile} />
        <ServiceModalityField offersLocal={form.offersLocal} offersHome={form.offersHome} onChange={(value) => setForm((current) => ({ ...current, ...value }))} />
        <label className="field-wide">Descripción<textarea required maxLength={4000} rows={4} value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Describe el servicio, experiencia y qué incluye." /></label>
        {error && <p className="create-service-error field-wide" role="alert">{error}</p>}
        <div className="create-service-actions field-wide">
          <Link to="/mis-servicios">Cancelar</Link>
          <button type="submit" disabled={saving || !categories.length}>{saving ? 'Publicando...' : 'Publicar servicio'}</button>
        </div>
        {!categories.length && <p className="create-service-error field-wide" role="status">No hay categorías disponibles para publicar.</p>}
      </form>
    </section>
  </main>
}