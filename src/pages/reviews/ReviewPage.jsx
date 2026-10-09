import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getReviewRequest, getServiceById, isSupabaseConfigured, submitServiceReview, supabase } from '../../utils/supabase'

const RATING_LABELS = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente']

export default function ReviewPage() {
  const { requestId } = useParams()
  const location = useLocation()
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [request, setRequest] = useState(null)
  const [requestLoading, setRequestLoading] = useState(false)
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [serviceAvailable, setServiceAvailable] = useState(false)
  const userId = session?.user?.id

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!userId) {
      setRequest(null)
      return
    }

    let cancelled = false
    setRequestLoading(true)
    getReviewRequest(requestId).then(({ data, error: loadError }) => {
      if (cancelled) return
      if (!loadError) setRequest(data)
      setRequestLoading(false)
    }).catch(() => {
      if (!cancelled) setRequestLoading(false)
    })

    return () => { cancelled = true }
  }, [requestId, userId])

  // Una publicación pausada, oculta o eliminada deja de ser visible: solo se enlaza si todavía se puede abrir.
  useEffect(() => {
    if (!request?.service_id) {
      setServiceAvailable(false)
      return
    }

    let cancelled = false
    getServiceById(request.service_id).then(({ data }) => {
      if (!cancelled) setServiceAvailable(Boolean(data))
    }).catch(() => {
      if (!cancelled) setServiceAvailable(false)
    })

    return () => { cancelled = true }
  }, [request?.service_id])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!rating || saving) return

    setSaving(true)
    setError('')
    const { error: submitError } = await submitServiceReview(requestId, rating, comment.trim())
    if (submitError) setError(submitError.message)
    else setDone(true)
    setSaving(false)
  }

  const shownRating = hover || rating
  const isRecipient = request && String(request.recipient_id) === String(userId)

  let content
  if (authLoading || requestLoading) content = <p>Cargando...</p>
  else if (!isSupabaseConfigured) content = <p>Configura Supabase para valorar servicios.</p>
  else if (!session) content = <>
    <p>Inicia sesión para valorar este servicio.</p>
    <Link className="review-link" to="/cuenta" state={{ backgroundLocation: location }}>Iniciar sesión <span aria-hidden="true">→</span></Link>
  </>
  else if (!request) content = <p>Esta solicitud de valoración no existe o no es para tu cuenta.</p>
  else if (!isRecipient) content = <p>Esta solicitud de valoración fue enviada a otra persona.</p>
  else if (done) content = <>
    <h1>¡Gracias por tu valoración!</h1>
    <p>Tu opinión sobre «{request.service_title}» ya es visible para otras personas.</p>
    {serviceAvailable ? <Link className="review-link" to={`/servicio/${request.service_id}`}>Ver el servicio <span aria-hidden="true">→</span></Link> : <p>Esta publicación ya no está disponible.</p>}
  </>
  else if (request.completed_at) content = <>
    <h1>Ya valoraste este servicio</h1>
    <p>Gracias por compartir tu experiencia con «{request.service_title}».</p>
    {serviceAvailable ? <Link className="review-link" to={`/servicio/${request.service_id}`}>Ver el servicio <span aria-hidden="true">→</span></Link> : <p>Esta publicación ya no está disponible.</p>}
  </>
  else content = <>
    <p className="eyebrow">VALORACIÓN</p>
    <h1>¿Cómo fue el servicio?</h1>
    <p className="review-subtitle"><strong>{request.requester_name}</strong> te pidió valorar «{request.service_title}».</p>
    <form className="review-form" onSubmit={handleSubmit}>
      <div className="review-stars" role="radiogroup" aria-label="Calidad del servicio" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((value) => <button
          key={value}
          type="button"
          role="radio"
          aria-checked={rating === value}
          aria-label={`${value} ${value === 1 ? 'estrella' : 'estrellas'}: ${RATING_LABELS[value]}`}
          className={value <= shownRating ? 'on' : ''}
          onMouseEnter={() => setHover(value)}
          onFocus={() => setHover(value)}
          onBlur={() => setHover(0)}
          onClick={() => setRating(value)}
        >★</button>)}
        <span className="review-rating-label" aria-live="polite">{RATING_LABELS[shownRating] || 'Selecciona una calificación'}</span>
      </div>
      <label>Comentario (opcional)
        <textarea rows={4} maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Cuéntanos cómo fue tu experiencia." />
      </label>
      {error && <p className="review-error" role="alert">{error}</p>}
      <button className="review-submit" type="submit" disabled={!rating || saving}>{saving ? 'Enviando...' : 'Enviar valoración'}</button>
    </form>
  </>

  return <main className="review-page"><section className="review-card">{content}</section></main>
}
