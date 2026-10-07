// Casillas "En local" / "A domicilio" para los formularios de servicio.
export function ServiceModalityField({ offersLocal, offersHome, onChange }) {
  const none = !offersLocal && !offersHome
  return <fieldset className="modality-field field-wide">
    <legend>Modalidad de atención</legend>
    <label className="modality-option"><input type="checkbox" checked={offersLocal} onChange={(event) => onChange({ offersLocal: event.target.checked, offersHome })} /> En local</label>
    <label className="modality-option"><input type="checkbox" checked={offersHome} onChange={(event) => onChange({ offersLocal, offersHome: event.target.checked })} /> A domicilio</label>
    {none && <small className="modality-error" role="alert">Selecciona al menos una modalidad.</small>}
  </fieldset>
}

// Etiquetas de solo lectura para tarjetas y detalle.
export function ModalityBadges({ service }) {
  const local = service.offers_local !== false
  const home = service.offers_home === true
  if (!local && !home) return null
  return <span className="modality-badges">
    {local && <span className="modality-badge">En local</span>}
    {home && <span className="modality-badge modality-badge--home">A domicilio</span>}
  </span>
}
