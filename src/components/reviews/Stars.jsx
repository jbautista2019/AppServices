// Estrellas de solo lectura (admite medias con relleno parcial).
export default function Stars({ value, size = 16, label }) {
  const rating = Math.max(0, Math.min(5, Number(value) || 0))
  return <span className="stars" role="img" aria-label={label || `${rating.toFixed(1)} de 5 estrellas`} style={{ fontSize: size }}>
    <span className="stars-empty" aria-hidden="true">★★★★★</span>
    <span className="stars-fill" aria-hidden="true" style={{ width: `${(rating / 5) * 100}%` }}>★★★★★</span>
  </span>
}
