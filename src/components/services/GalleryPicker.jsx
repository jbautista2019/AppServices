import { useEffect, useMemo, useRef, useState } from 'react'
import { SERVICE_GALLERY_MAX, SERVICE_IMAGE_TYPES, validateServiceImage } from '../../utils/supabase'

// Fotos adicionales de la publicación. `urls` son las ya guardadas y `files` las nuevas aún sin subir; entre ambas hay un máximo.
export default function GalleryPicker({ urls = [], files = [], onUrlsChange, onFilesChange }) {
  const inputRef = useRef(null)
  const [error, setError] = useState('')
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files])
  const total = urls.length + files.length
  const remaining = SERVICE_GALLERY_MAX - total

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews])

  function handleSelect(event) {
    const selected = [...(event.target.files || [])]
    event.target.value = ''
    if (!selected.length) return

    const accepted = []
    let message = ''
    for (const file of selected) {
      const validationError = validateServiceImage(file)
      if (validationError) message = validationError
      else if (accepted.length < remaining) accepted.push(file)
      else message = `Puedes agregar hasta ${SERVICE_GALLERY_MAX} fotos adicionales.`
    }
    setError(message)
    if (accepted.length) onFilesChange([...files, ...accepted])
  }

  return <div className="gallery-picker field-wide">
    <span className="image-picker-label">Fotos adicionales (opcional)</span>
    <ul className="gallery-picker-list">
      {urls.map((url) => <li key={url}>
        <img src={url} alt="Foto adicional guardada" />
        <button type="button" aria-label="Quitar foto" onClick={() => onUrlsChange(urls.filter((item) => item !== url))}>×</button>
      </li>)}
      {files.map((file, index) => <li key={`${file.name}-${file.size}-${index}`}>
        <img src={previews[index]} alt="Vista previa de foto nueva" />
        <button type="button" aria-label="Quitar foto" onClick={() => onFilesChange(files.filter((_, position) => position !== index))}>×</button>
      </li>)}
      {remaining > 0 && <li>
        <button type="button" className="gallery-picker-add" onClick={() => inputRef.current?.click()}>+ Agregar</button>
      </li>}
    </ul>
    <small>{total} de {SERVICE_GALLERY_MAX} · JPG, PNG o WebP · máx. 5 MB cada una</small>
    <input ref={inputRef} type="file" multiple accept={SERVICE_IMAGE_TYPES.join(',')} hidden onChange={handleSelect} />
    {error && <p className="image-picker-error" role="alert">{error}</p>}
  </div>
}
