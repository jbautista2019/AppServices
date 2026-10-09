import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { isCategoryAdmin, isSupabaseConfigured, listPromotions, REPORTS_CHANGED_EVENT, setPromotionStatus, supabase } from '../../utils/supabase'

const STATUS_LABELS = { pending: 'Pendiente', active: 'Activa', rejected: 'Rechazada', cancelled: 'Finalizada' }
const FILTERS = [
  { id: 'pending', label: 'Pendientes' },
  { id: 'active', label: 'Activas' },
  { id: 'history', label: 'Historial' },
  { id: 'all', label: 'Todas' },
]
const formatPrice = (amount) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount)
const formatDate = (value) => new Date(value).toLocaleDateString('es-CL')
const matchesFilter = (promotion, filter) => filter === 'all' || (filter === 'history' ? ['rejected', 'cancelled'].includes(promotion.status) : promotion.status === filter)

export default function AdminPromotionsPage() {
  const location = useLocation()
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [adminLoading, setAdminLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [promotions, setPromotions] = useState([])
  const [filter, setFilter] = useState('pending')
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState('')
  const [noticeType, setNoticeType] = useState('info')

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

  const userId = session?.user?.id

  const load = useCallback(async () => {
    const { data, error } = await listPromotions()
    if (error) {
      setNoticeType('error')
      setNotice(error.message)
      return
    }
    setPromotions(data)
  }, [])

  useEffect(() => {
    if (!userId) {
      setAdminLoading(false)
      setIsAdmin(false)
      setPromotions([])
      return
    }

    let cancelled = false
    setAdminLoading(true)

    async function start() {
      const { data: authorized, error } = await isCategoryAdmin()
      if (cancelled) return
      if (error || !authorized) {
        setIsAdmin(false)
        setNoticeType('error')
        setNotice(error ? 'No se pudo verificar tu permiso de administrador.' : 'Esta cuenta no tiene permiso para ver las promociones.')
        setAdminLoading(false)
        return
      }
      setIsAdmin(true)
      await load()
      if (!cancelled) setAdminLoading(false)
    }

    start()
    return () => { cancelled = true }
  }, [userId, load])

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((item) => [item.id, promotions.filter((promotion) => matchesFilter(promotion, item.id)).length])), [promotions])
  const visible = promotions.filter((promotion) => matchesFilter(promotion, filter))

  async function change(promotion, status, confirmation, successText) {
    if (confirmation && !window.confirm(confirmation)) return

    setBusyId(promotion.id)
    setNotice('')
    const { error } = await setPromotionStatus(promotion.id, status)
    if (error) {
      setNoticeType('error')
      setNotice(error.message)
    } else {
      await load()
      window.dispatchEvent(new Event(REPORTS_CHANGED_EVENT))
      setNoticeType('success')
      setNotice(successText)
    }
    setBusyId(null)
  }

  return (
    <main className="admin-users-page admin-reports-page">
      <header className="admin-users-heading">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN</p>
          <h1>Promociones premium</h1>
          <p>Activa los planes una vez confirmado el pago. Al activar, la publicación sale destacada en la portada hasta que venza el plan.</p>
        </div>
      </header>

      {!isSupabaseConfigured && <p className="category-admin-notice">Configura Supabase para ver las promociones.</p>}
      {isSupabaseConfigured && authLoading && <p className="category-admin-notice">Comprobando sesión...</p>}
      {isSupabaseConfigured && !authLoading && !session && <p className="category-admin-notice">Inicia sesión con una cuenta administradora para ver las promociones. <Link to="/cuenta" state={{ backgroundLocation: location }}>Iniciar sesión →</Link></p>}
      {isSupabaseConfigured && session && adminLoading && <p className="category-admin-notice">Cargando promociones...</p>}
      {isSupabaseConfigured && session && isAdmin && !adminLoading && <section className="admin-reports-content">
        <div className="admin-reports-filters" role="tablist" aria-label="Filtrar por estado">
          {FILTERS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} className={filter === item.id ? 'is-active' : ''} onClick={() => setFilter(item.id)}>{item.label} <small>{counts[item.id]}</small></button>)}
        </div>

        {visible.length ? <ul className="admin-reports-list">{visible.map((promotion) => <li className="admin-report" key={promotion.id}>
          <div className="admin-report-main">
            <div className="admin-report-top">
              <span className={`plan-status plan-status--${promotion.status}`}>{STATUS_LABELS[promotion.status]}</span>
              <strong>{promotion.plan_name}</strong>
              <span>{formatPrice(promotion.price_clp)} · {promotion.days} días</span>
            </div>
            <p className="admin-report-service">
              {promotion.service_exists ? <Link to={`/servicio/${promotion.service_id}`}>{promotion.service_title}</Link> : <strong>{promotion.service_title}</strong>} · {promotion.provider_name}
              {!promotion.service_exists && <span className="admin-report-hidden">Eliminada</span>}
            </p>
            <small className="admin-report-reporter">
              {promotion.user_email} · solicitado el {formatDate(promotion.requested_at)}
              {promotion.status === 'active' && promotion.ends_at ? ` · activa hasta el ${formatDate(promotion.ends_at)}` : ''}
            </small>
          </div>
          <div className="admin-users-actions admin-report-actions">
            {promotion.status === 'pending' && <button type="button" disabled={busyId === promotion.id || !promotion.service_exists} onClick={() => change(promotion, 'active', `¿Confirmaste el pago de «${promotion.plan_name}» (${formatPrice(promotion.price_clp)})? Se activará por ${promotion.days} días.`, 'Plan activado. El profesional recibió un aviso.')}>Activar plan</button>}
            {promotion.status === 'pending' && <button type="button" disabled={busyId === promotion.id} onClick={() => change(promotion, 'rejected', '¿Rechazar esta solicitud?', 'Solicitud rechazada.')}>Rechazar</button>}
            {promotion.status === 'active' && <button type="button" disabled={busyId === promotion.id} onClick={() => change(promotion, 'cancelled', '¿Finalizar este plan ahora? La publicación dejará de estar destacada.', 'Plan finalizado.')}>Finalizar plan</button>}
          </div>
        </li>)}</ul> : <p className="category-admin-notice">No hay promociones en esta categoría.</p>}
      </section>}
      {notice && <div className={`category-admin-toast category-admin-toast--${noticeType}`} role={noticeType === 'error' ? 'alert' : 'status'}>
        <span className="category-admin-toast-icon" aria-hidden="true">{noticeType === 'success' ? '✓' : '!'}</span>
        <p>{notice}</p>
        <button type="button" aria-label="Cerrar aviso" onClick={() => setNotice('')}>×</button>
      </div>}
    </main>
  )
}
