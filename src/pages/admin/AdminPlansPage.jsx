import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { deletePlan, isCategoryAdmin, isSupabaseConfigured, listAllPlans, savePlan, supabase } from '../../utils/supabase'

const formatPrice = (amount) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount)

function emptyForm(sortOrder) {
  return { id: null, name: '', description: '', days: '30', price: '', featuresText: '', highlighted: false, isActive: true, sortOrder: String(sortOrder) }
}

function formFromPlan(plan) {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description || '',
    days: String(plan.days),
    price: String(plan.price_clp),
    featuresText: (plan.features || []).join('\n'),
    highlighted: plan.highlighted,
    isActive: plan.is_active,
    sortOrder: String(plan.sort_order),
  }
}

function planToPayload(plan) {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description || '',
    days: plan.days,
    price_clp: plan.price_clp,
    features: plan.features || [],
    highlighted: plan.highlighted,
    is_active: plan.is_active,
    sort_order: plan.sort_order,
  }
}

export default function AdminPlansPage() {
  const location = useLocation()
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [adminLoading, setAdminLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [plans, setPlans] = useState([])
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
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
    const { data, error } = await listAllPlans()
    if (error) {
      setNoticeType('error')
      setNotice(error.message)
      return
    }
    setPlans(data)
  }, [])

  useEffect(() => {
    if (!userId) {
      setAdminLoading(false)
      setIsAdmin(false)
      setPlans([])
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
        setNotice(error ? 'No se pudo verificar tu permiso de administrador.' : 'Esta cuenta no tiene permiso para configurar los planes.')
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

  const nextSortOrder = plans.length ? Math.max(...plans.map((plan) => plan.sort_order)) + 1 : 1
  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  async function persist(payload, successText) {
    setBusy(true)
    setNotice('')
    const { error } = await savePlan(payload)
    if (error) {
      setNoticeType('error')
      setNotice(error.message)
      setBusy(false)
      return false
    }
    await load()
    setNoticeType('success')
    setNotice(successText)
    setBusy(false)
    return true
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const payload = {
      id: form.id,
      name: form.name,
      description: form.description,
      days: Number(form.days),
      price_clp: Number(form.price),
      features: form.featuresText.split('\n'),
      highlighted: form.highlighted,
      is_active: form.isActive,
      sort_order: Number(form.sortOrder) || 0,
    }
    const saved = await persist(payload, form.id ? 'Plan actualizado.' : 'Plan creado.')
    if (saved) setForm(null)
  }

  function toggleActive(plan) {
    return persist({ ...planToPayload(plan), is_active: !plan.is_active }, plan.is_active ? 'Plan desactivado: ya no se ofrece en /planes.' : 'Plan activado: ya se ofrece en /planes.')
  }

  async function handleDelete(plan) {
    if (!window.confirm(`¿Eliminar el plan «${plan.name}»? Esta acción no se puede deshacer.`)) return

    setBusy(true)
    setNotice('')
    const { error } = await deletePlan(plan.id)
    if (error) {
      setNoticeType('error')
      setNotice(error.message)
    } else {
      if (form?.id === plan.id) setForm(null)
      await load()
      setNoticeType('success')
      setNotice('Plan eliminado.')
    }
    setBusy(false)
  }

  return (
    <main className="admin-users-page admin-reports-page admin-plans-page">
      <header className="admin-users-heading">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN</p>
          <h1>Planes premium</h1>
          <p>Crea y configura los planes que se ofrecen en /planes. Los cambios se guardan en la base de datos y se ven al instante.</p>
        </div>
        {isAdmin && !form && <button type="button" className="admin-plans-new" onClick={() => setForm(emptyForm(nextSortOrder))}>+ Nuevo plan</button>}
      </header>

      {!isSupabaseConfigured && <p className="category-admin-notice">Configura Supabase para configurar los planes.</p>}
      {isSupabaseConfigured && authLoading && <p className="category-admin-notice">Comprobando sesión...</p>}
      {isSupabaseConfigured && !authLoading && !session && <p className="category-admin-notice">Inicia sesión con una cuenta administradora para configurar los planes. <Link to="/cuenta" state={{ backgroundLocation: location }}>Iniciar sesión</Link></p>}
      {isSupabaseConfigured && session && adminLoading && <p className="category-admin-notice">Cargando planes...</p>}
      {isSupabaseConfigured && session && isAdmin && !adminLoading && <section className="admin-reports-content">
        {form && <form className="admin-plan-form" onSubmit={handleSubmit}>
          <h2>{form.id ? 'Editar plan' : 'Nuevo plan'}</h2>
          <label className="admin-plan-wide">Nombre<input required maxLength={80} value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Ej. Premium 30 días" /></label>
          <label className="admin-plan-wide">Descripción<input maxLength={300} value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Frase corta que se muestra bajo el nombre" /></label>
          <label>Duración (días)<input required type="number" min="1" max="3650" step="1" value={form.days} onChange={(event) => updateField('days', event.target.value)} /></label>
          <label>Precio (CLP)<input required type="number" min="0" step="1" value={form.price} onChange={(event) => updateField('price', event.target.value)} placeholder="9990" /></label>
          <label>Orden en la página<input type="number" step="1" value={form.sortOrder} onChange={(event) => updateField('sortOrder', event.target.value)} /></label>
          <label className="admin-plan-wide">Características (una por línea, máximo 12)<textarea rows={5} value={form.featuresText} onChange={(event) => updateField('featuresText', event.target.value)} placeholder={'Tu publicación en la portada\nInsignia Premium'} /></label>
          <div className="admin-plan-switches admin-plan-wide">
            <label><input type="checkbox" checked={form.highlighted} onChange={(event) => updateField('highlighted', event.target.checked)} /> Plan destacado (recomendado)</label>
            <label><input type="checkbox" checked={form.isActive} onChange={(event) => updateField('isActive', event.target.checked)} /> Activo (se ofrece en /planes)</label>
          </div>
          <div className="admin-plan-actions admin-plan-wide">
            <button type="submit" disabled={busy}>{busy ? 'Guardando...' : form.id ? 'Guardar cambios' : 'Crear plan'}</button>
            <button type="button" disabled={busy} onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </form>}

        {plans.length ? <ul className="admin-reports-list">{plans.map((plan) => <li className="admin-report" key={plan.id}>
          <div className="admin-report-main">
            <div className="admin-report-top">
              <strong>{plan.name}</strong>
              {plan.highlighted && <span className="plan-status plan-status--active">Destacado</span>}
              <span className={`plan-status ${plan.is_active ? 'plan-status--active' : 'plan-status--cancelled'}`}>{plan.is_active ? 'Activo' : 'Inactivo'}</span>
            </div>
            <p className="admin-report-service">
              <strong>{formatPrice(plan.price_clp)}</strong> · {plan.days} días · {formatPrice(Math.round(plan.price_clp / (plan.days / 30)))} al mes
            </p>
            {plan.description && <small className="admin-report-reporter">{plan.description}</small>}
            {plan.features?.length > 0 && <ul className="admin-plan-features">{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>}
          </div>
          <div className="admin-users-actions admin-report-actions">
            <button type="button" disabled={busy} onClick={() => setForm(formFromPlan(plan))}>Editar</button>
            <button type="button" disabled={busy} onClick={() => toggleActive(plan)}>{plan.is_active ? 'Desactivar' : 'Activar'}</button>
            <button type="button" disabled={busy} onClick={() => handleDelete(plan)}>Eliminar</button>
          </div>
        </li>)}</ul> : <p className="category-admin-notice">Todavía no hay planes. Crea el primero con «Nuevo plan».</p>}
      </section>}
      {notice && <div className={`category-admin-toast category-admin-toast--${noticeType}`} role={noticeType === 'error' ? 'alert' : 'status'}>
        <span className="category-admin-toast-icon" aria-hidden="true">{noticeType === 'success' ? '✓' : '!'}</span>
        <p>{notice}</p>
        <button type="button" aria-label="Cerrar aviso" onClick={() => setNotice('')}>×</button>
      </div>}
    </main>
  )
}
