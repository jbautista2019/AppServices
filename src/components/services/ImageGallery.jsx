import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const SWIPE_MIN_PX = 40
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

// Galería del detalle: foto grande con flechas anterior/siguiente (circulares), contador, teclado (← →), deslizar en
// pantallas táctiles y miniaturas. Al hacer clic en la foto se abre un visor a pantalla grande (modal).
export default function ImageGallery({ images, alt }) {
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(false)
  const openerRef = useRef(null)
  const count = images.length
  const current = Math.min(index, Math.max(count - 1, 0))

  const go = useCallback((delta) => setIndex((value) => (Math.min(value, count - 1) + delta + count) % count), [count])
  const close = useCallback(() => {
    setOpen(false)
    // El foco vuelve a la foto que abrió el visor.
    requestAnimationFrame(() => openerRef.current?.focus())
  }, [])

  if (!count) return null

  function handleKeyDown(event) {
    // Con el visor abierto las flechas las maneja el visor (sus eventos también suben por React hasta aquí).
    if (open || count < 2) return
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1) }
    if (event.key === 'ArrowRight') { event.preventDefault(); go(1) }
  }

  return <div className="image-gallery" role="group" aria-roledescription="carrusel" aria-label="Fotos de la publicación" tabIndex={count > 1 ? 0 : undefined} onKeyDown={handleKeyDown}>
    <div className="image-gallery-stage">
      <button ref={openerRef} type="button" className="image-gallery-open" aria-label="Ampliar foto" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <img key={images[current]} className="detail-image image-gallery-main" src={images[current]} alt={count > 1 ? `${alt} (foto ${current + 1} de ${count})` : alt} draggable={false} />
      </button>
      {count > 1 && <>
        <button type="button" className="image-gallery-arrow image-gallery-arrow--prev" aria-label="Foto anterior" onClick={() => go(-1)}>‹</button>
        <button type="button" className="image-gallery-arrow image-gallery-arrow--next" aria-label="Foto siguiente" onClick={() => go(1)}>›</button>
        <span className="image-gallery-counter" aria-live="polite">{current + 1} / {count}</span>
      </>}
    </div>
    {count > 1 && <div className="detail-gallery" role="list" aria-label="Miniaturas">{images.map((url, position) => <button key={url} type="button" role="listitem" className={position === current ? 'is-active' : ''} aria-label={`Ver foto ${position + 1} de ${count}`} aria-current={position === current} onClick={() => setIndex(position)}><img src={url} alt="" /></button>)}</div>}
    {open && <Lightbox images={images} alt={alt} index={current} onSelect={setIndex} onStep={go} onClose={close} />}
  </div>
}

// Visor a pantalla grande: fondo oscuro, foto centrada, flechas laterales, miniaturas, contador y botón de cerrar.
function Lightbox({ images, alt, index, onSelect, onStep, onClose }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const touchStartX = useRef(null)
  const count = images.length

  useEffect(() => {
    closeRef.current?.focus()
    // Bloquea el scroll de la página de fondo mientras el visor está abierto. Se bloquea html además de body porque
    // la app define overflow-x: clip en html, y entonces el scroll de la página lo tiene html y no body.
    const previousBody = document.body.style.overflow
    const previousRoot = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key === 'ArrowLeft' && count > 1) { event.preventDefault(); onStep(-1); return }
      if (event.key === 'ArrowRight' && count > 1) { event.preventDefault(); onStep(1); return }
      if (event.key === 'Tab' && dialogRef.current) {
        // El foco no sale del visor.
        const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)].filter((el) => !el.disabled)
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousBody
      document.documentElement.style.overflow = previousRoot
    }
  }, [count, onClose, onStep])

  function handleTouchEnd(event) {
    if (touchStartX.current === null) return
    const delta = event.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (count > 1 && Math.abs(delta) >= SWIPE_MIN_PX) onStep(delta < 0 ? 1 : -1)
  }

  return createPortal(
    <div ref={dialogRef} className="lightbox" role="dialog" aria-modal="true" aria-label="Fotos de la publicación" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      {count > 1 && <span className="lightbox-counter" aria-live="polite">{index + 1} / {count}</span>}
      <button ref={closeRef} type="button" className="lightbox-close" aria-label="Cerrar" onClick={onClose}>×</button>
      {count > 1 && <div className="lightbox-thumbs" role="list" aria-label="Miniaturas">{images.map((url, position) => <button key={url} type="button" role="listitem" className={position === index ? 'is-active' : ''} aria-label={`Ver foto ${position + 1} de ${count}`} aria-current={position === index} onClick={() => onSelect(position)}><img src={url} alt="" /></button>)}</div>}
      {count > 1 && <button type="button" className="lightbox-arrow lightbox-arrow--prev" aria-label="Foto anterior" onClick={() => onStep(-1)}>‹</button>}
      <div className="lightbox-stage" onClick={(event) => { if (event.target === event.currentTarget) onClose() }} onTouchStart={(event) => { touchStartX.current = event.touches[0].clientX }} onTouchEnd={handleTouchEnd}>
        <img key={images[index]} className="lightbox-image" src={images[index]} alt={count > 1 ? `${alt} (foto ${index + 1} de ${count})` : alt} draggable={false} />
      </div>
      {count > 1 && <button type="button" className="lightbox-arrow lightbox-arrow--next" aria-label="Foto siguiente" onClick={() => onStep(1)}>›</button>}
    </div>,
    document.body,
  )
}
