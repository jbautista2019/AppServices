import { useEffect, useState } from 'react'
import { REPORT_REASONS, reportService } from '../../utils/supabase'

export default function ReportServiceButton({ serviceId, loggedIn, onRequireLogin }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  function openDialog() {
    if (!loggedIn) {
      onRequireLogin()
      return
    }
    setError('')
    setSent(false)
    setReason('')
    setDetails('')
    setOpen(true)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!reason) {
      setError('Selecciona un motivo.')
      return
    }

    setBusy(true)
    setError('')
    const { error: reportError } = await reportService(serviceId, reason, details.trim())
    setBusy(false)
    if (reportError) {
      setError(reportError.message)
      return
    }
    setSent(true)
  }

  return <>
    <button className="report-link" type="button" onClick={openDialog}><span aria-hidden="true">⚑</span> Reportar publicación</button>
    {open && <div className="report-backdrop" onClick={() => setOpen(false)}>
      <div className="report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-title" onClick={(event) => event.stopPropagation()}>
        {sent ? <>
          <h2 id="report-title">Gracias por avisarnos</h2>
          <p>Recibimos tu reporte y lo revisaremos a la brevedad.</p>
          <div className="report-actions"><button type="button" className="report-submit" onClick={() => setOpen(false)}>Cerrar</button></div>
        </> : <form onSubmit={handleSubmit}>
          <h2 id="report-title">Reportar publicación</h2>
          <p>Cuéntanos qué está mal con esta publicación.</p>
          <fieldset>
            <legend className="sr-only">Motivo</legend>
            {REPORT_REASONS.map((item) => <label key={item.value} className="report-reason"><input type="radio" name="report-reason" value={item.value} checked={reason === item.value} onChange={() => setReason(item.value)} /> {item.label}</label>)}
          </fieldset>
          <label className="report-details">Detalles (opcional)<textarea rows={3} maxLength={1000} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Agrega información que ayude a revisar el caso" /></label>
          {error && <p className="report-error" role="alert">{error}</p>}
          <div className="report-actions">
            <button type="button" className="report-cancel" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" className="report-submit" disabled={busy}>{busy ? 'Enviando...' : 'Enviar reporte'}</button>
          </div>
        </form>}
      </div>
    </div>}
  </>
}
