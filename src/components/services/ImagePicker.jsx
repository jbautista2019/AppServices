import { useEffect, useRef, useState } from 'react'
import { SERVICE_IMAGE_TYPES, validateServiceImage } from '../../utils/supabase'

// Selector de imagen con vista previa. `currentUrl` es la imagen ya guardada; `file` el archivo nuevo elegido.
export default function ImagePicker({ currentUrl, file, onChange, onRemoveCurrent, removed }) {
  const inputRef = useRef(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function handleSelect(event) {
    const selected = event.target.files?.[0]
    event.target.value = ''
    if (!selected) return
    const validationError = validateServiceImage(selected)
    setError(validationError)
    if (!validationError) onChange(selected)
  }

  const shownUrl = previewUrl || (removed ? '' : currentUrl)

  return <div className="image-picker">
    <span className="image-picker-label">Imagen (opcional)</span>
    {shownUrl && <img className="image-picker-preview" src={shownUrl} alt="Vista previa de la imagen del servicio" />}
    <div className="image-picker-actions">
      <button type="button" onClick={() => inputRef.current?.click()}>{shownUrl ? 'Cambiar imagen' : 'Subir imagen'}</button>
      {shownUrl && <button type="button" className="image-picker-remove" onClick={() => { setError(''); if (file) onChange(null); else onRemoveCurrent?.() }}>Quitar</button>}
      <small>JPG, PNG o WebP · máx. 5 MB</small>
    </div>
    <input ref={inputRef} type="file" accept={SERVICE_IMAGE_TYPES.join(',')} hidden onChange={handleSelect} />
    {error && <p className="image-picker-error" role="alert">{error}</p>}
  </div>
}
