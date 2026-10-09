import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { isCategoryAdmin, isSupabaseConfigured, listServiceReports, REPORT_REASONS, REPORTS_CHANGED_EVENT, setReportStatus, setServiceActive, supabase } from '../../utils/supabase'

const STATUS_LABELS = { pending: 'Pendiente', reviewed: 'Revisado', dismissed: 'Descartado' }
const FILTERS = [
  { id: 'pending', label: 'Pendientes' },
  { id: 'reviewed', label: 'Revisados' },
  { id: 'dismissed', label: 'Descartados' },
  { id: 'all', label: 'Todos' },
]
const reasonLabel = (value) => REPORT_REASONS.find((item) => item.value === value)?.label || value

export default function AdminReportsPage() {
  const location = useLocation()
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [adminLoading, setAdminLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [reports, setReports] = useState([])
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

  const loadReports = useCallback(async () => {
    const { data, error } = await listServiceReports()
    if (error) {
      setNoticeType('error')
      setNotice(error.message)
      return
    }
    setReports(data)
  }, [])

  useEffect(() => {
    if (!userId) {
      setAdminLoading(false)
      setIsAdmin(false)
      setReports([])
      return
    }

    let cancelled = false
    setAdminLoading(true)

    async function load() {
      const { data: authorized, error } = await isCategoryAdmin()
      if (cancelled) return
      if (error || !authorized) {
        setIsAdmin(false)
        setNoticeType('error')
        setNotice(error ? 'No se pudo verificar tu permiso de administrador.' : 'Esta cuenta no tiene permiso para ver los reportes.')
        setAdminLoading(false)
        return
      }

      setIsAdmin(true)
      await loadReports()
      if (!cancelled) setAdminLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [userId, loadReports])

  const counts = useMemo(() => {
    const result = { all: reports.length, pending: 0, reviewed: 0, dismissed: 0 }
    for (const report of reports) result[report.status] += 1
    return result
  }, [reports])
  const visibleReports = filter === 'all' ? reports : reports.filter((report) => report.status === filter)

  async function runAction(report, action, successText) {
    setBusyId(report.id)
    setNotice('')
    const { error } = await action()
    if (error) {
      setNoticeType('error')
      setNotice(error.message)
    } else {
      await loadReports()
      window.dispatchEvent(new Event(REPORTS_CHANGED_EVENT))
      setNoticeType('success')
      setNotice(successText)
    }
    setBusyId(null)
  }

  const changeStatus = (report, status, text) => runAction(report, () => setReportStatus(report.id, status), text)
  const toggleService = (report) => runAction(report, () => setServiceActive(report.service_id, !report.service_active), report.service_active ? 'La publicación quedó oculta.' : 'La publicación volvió a estar visible.')

  return (
    <main className="admin-users-page admin-reports-page">
      <header className="admin-users-heading">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN</p>
          <h1>Reportes de publicaciones</h1>
          <p>Revisa los reportes de la comunidad y decide qué hacer con cada publicación.</p>
        </div>
      </header>

      {!isSupabaseConfigured && <p className="category-admin-notice">Configura Supabase para ver los reportes.</p>}
      {isSupabaseConfigured && authLoading && <p className="category-admin-notice">Comprobando sesión...</p>}
      {isSupabaseConfigured && !authLoading && !session && <p className="category-admin-notice">Inicia sesión con una cuenta administradora para ver los reportes. <Link to="/cuenta" state={{ backgroundLocation: location }}>Iniciar sesión →</Link></p>}
      {isSupabaseConfigured && session && adminLoading && <p className="category-admin-notice">Cargando reportes...</p>}
      {isSupabaseConfigured && session && isAdmin && !adminLoading && <section className="admin-reports-content">
        <div className="admin-reports-filters" role="tablist" aria-label="Filtrar por estado">
          {FILTERS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} className={filter === item.id ? 'is-active' : ''} onClick={() => setFilter(item.id)}>{item.label} <small>{counts[item.id]}</small></button>)}
        </div>

        {visibleReports.length ? <ul className="admin-reports-list">{visibleReports.map((report) => <li className="admin-report" key={report.id}>
          <div className="admin-report-main">
            <div className="admin-report-top">
              <span className={`admin-report-status admin-report-status--${report.status}`}>{STATUS_LABELS[report.status]}</span>
              <strong>{reasonLabel(report.reason)}</strong>
              <time dateTime={report.created_at}>{new Date(report.created_at).toLocaleDateString('es-CL')}</time>
            </div>
            <p className="admin-report-service">
              <Link to={`/servicio/${report.service_id}`}>{report.service_title}</Link> · {report.provider_name}
              {!report.service_active && <span className="admin-report-hidden">Oculta</span>}
              {Number(report.report_count) > 1 && <span className="admin-report-count">{report.report_count} reportes en total</span>}
            </p>
            {report.details ? <p className="admin-report-details">{report.details}</p> : <p className="admin-report-details admin-report-details--empty">Sin detalles.</p>}
            <small className="admin-report-reporter">Reportado por {report.reporter_name || 'usuario'}{report.reporter_email ? ` (${report.reporter_email})` : ''}</small>
          </div>
          <div className="admin-users-actions admin-report-actions">
            <button type="button" disabled={busyId === report.id} onClick={() => toggleService(report)}>{report.service_active ? 'Ocultar publicación' : 'Mostrar publicación'}</button>
            {report.status !== 'reviewed' && <button type="button" disabled={busyId === report.id} onClick={() => changeStatus(report, 'reviewed', 'Reporte marcado como revisado.')}>Marcar revisado</button>}
            {report.status !== 'dismissed' && <button type="button" disabled={busyId === report.id} onClick={() => changeStatus(report, 'dismissed', 'Reporte descartado.')}>Descartar</button>}
            {report.status !== 'pending' && <button type="button" disabled={busyId === report.id} onClick={() => changeStatus(report, 'pending', 'Reporte reabierto.')}>Reabrir</button>}
          </div>
        </li>)}</ul> : <p className="category-admin-notice">No hay reportes en esta categoría.</p>}
      </section>}
      {notice && <div className={`category-admin-toast category-admin-toast--${noticeType}`} role={noticeType === 'error' ? 'alert' : 'status'}>
        <span className="category-admin-toast-icon" aria-hidden="true">{noticeType === 'success' ? '✓' : '!'}</span>
        <p>{notice}</p>
        <button type="button" aria-label="Cerrar aviso" onClick={() => setNotice('')}>×</button>
      </div>}
    </main>
  )
}
