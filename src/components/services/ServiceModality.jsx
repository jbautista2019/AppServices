const ICONS = {
  local: <><path d="M3 9.5 4.5 4h15L21 9.5" /><path d="M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /><path d="M5 12.5V20h14v-7.5" /><path d="M10 20v-4.5h4V20" /></>,
  home: <><path d="m3 11 9-7.5 9 7.5" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5h4v5" /></>,
}

// Interruptor tipo "favorito": un botón con icono que se rellena al activarlo.
function ModalityToggle({ name, label, active, onToggle }) {
  return <button className={`modality-toggle${active ? ' on' : ''}`} type="button" aria-pressed={active} onClick={onToggle}>
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" fillOpacity={active ? 0.28 : 0} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[name]}</svg>
    <span>{label}</span>
  </button>
}

// Selector "Local comercial" / "A domicilio" para los formularios de servicio.
export function ServiceModalityField({ offersLocal, offersHome, onChange }) {
  const none = !offersLocal && !offersHome
  return <fieldset className="modality-field field-wide">
    <legend>Modalidad de atención</legend>
    <ModalityToggle name="local" label="Local comercial" active={offersLocal} onToggle={() => onChange({ offersLocal: !offersLocal, offersHome })} />
    <ModalityToggle name="home" label="A domicilio" active={offersHome} onToggle={() => onChange({ offersLocal, offersHome: !offersHome })} />
    {none && <small className="modality-error" role="alert">Selecciona al menos una modalidad.</small>}
  </fieldset>
}

// Etiquetas de solo lectura para tarjetas y detalle.
export function ModalityBadges({ service }) {
  const local = service.offers_local !== false
  const home = service.offers_home === true
  if (!local && !home) return null
  return <span className="modality-badges">
    {local && <span className="modality-badge">Local comercial</span>}
    {home && <span className="modality-badge modality-badge--home">A domicilio</span>}
  </span>
}
