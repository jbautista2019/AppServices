import { useRef, useState } from 'react'

const SWIPE_MIN_PX = 40

// Galería del detalle: foto grande con zoom al pasar el ratón, flechas anterior/siguiente (circulares),
// contador, teclado (← →), deslizar en pantallas táctiles y miniaturas.
export default function ImageGallery({ images, alt }) {
  const [index, setIndex] = useState(0)
  const touchStartX = useRef(null)
  const count = images.length
  const current = Math.min(index, Math.max(count - 1, 0))

  if (!count) return null

  const go = (delta) => setIndex((value) => (Math.min(value, count - 1) + delta + count) % count)

  function handleKeyDown(event) {
    if (count < 2) return
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1) }
    if (event.key === 'ArrowRight') { event.preventDefault(); go(1) }
  }

  // El zoom se hace con CSS (:hover); aquí solo se indica hacia qué punto de la foto se acerca.
  function handleMouseMove(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty('--zoom-x', `${((event.clientX - rect.left) / rect.width) * 100}%`)
    event.currentTarget.style.setProperty('--zoom-y', `${((event.clientY - rect.top) / rect.height) * 100}%`)
  }

  function handleTouchEnd(event) {
    if (touchStartX.current === null) return
    const delta = event.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(delta) >= SWIPE_MIN_PX) go(delta < 0 ? 1 : -1)
  }

  return <div className="image-gallery" role="group" aria-roledescription="carrusel" aria-label="Fotos de la publicación" tabIndex={count > 1 ? 0 : undefined} onKeyDown={handleKeyDown}>
    <div className="image-gallery-stage" onMouseMove={handleMouseMove} onTouchStart={(event) => { touchStartX.current = event.touches[0].clientX }} onTouchEnd={handleTouchEnd}>
      <img key={images[current]} className="detail-image image-gallery-main" src={images[current]} alt={count > 1 ? `${alt} (foto ${current + 1} de ${count})` : alt} draggable={false} />
      {count > 1 && <>
        <button type="button" className="image-gallery-arrow image-gallery-arrow--prev" aria-label="Foto anterior" onClick={() => go(-1)}>‹</button>
        <button type="button" className="image-gallery-arrow image-gallery-arrow--next" aria-label="Foto siguiente" onClick={() => go(1)}>›</button>
        <span className="image-gallery-counter" aria-live="polite">{current + 1} / {count}</span>
      </>}
    </div>
    {count > 1 && <div className="detail-gallery" role="list" aria-label="Miniaturas">{images.map((url, position) => <button key={url} type="button" role="listitem" className={position === current ? 'is-active' : ''} aria-label={`Ver foto ${position + 1} de ${count}`} aria-current={position === current} onClick={() => setIndex(position)}><img src={url} alt="" /></button>)}</div>}
  </div>
}
