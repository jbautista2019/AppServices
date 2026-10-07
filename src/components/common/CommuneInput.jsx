import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { getCommunes } from '../../utils/supabase'

const MAX_SUGGESTIONS = 8

function normalize(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es-CL').trim()
}

// Campo de texto con autocompletado de comunas de la Región Metropolitana (ignora tildes y mayúsculas).
export default function CommuneInput({ value, onChange, className, ...inputProps }) {
  const listId = useId()
  const wrapperRef = useRef(null)
  const [communes, setCommunes] = useState([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  useEffect(() => {
    let cancelled = false
    getCommunes().then((list) => {
      if (!cancelled) setCommunes(list)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const suggestions = useMemo(() => {
    const term = normalize(value || '')
    if (!term) return []
    const starts = []
    const contains = []
    for (const commune of communes) {
      const name = normalize(commune)
      if (name === term) return []
      if (name.startsWith(term)) starts.push(commune)
      else if (name.includes(term)) contains.push(commune)
    }
    return [...starts, ...contains].slice(0, MAX_SUGGESTIONS)
  }, [value, communes])

  const expanded = open && suggestions.length > 0

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event) {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  function select(commune) {
    onChange(commune)
    setOpen(false)
    setActiveIndex(-1)
  }

  function handleKeyDown(event) {
    if (!expanded) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1))
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      select(suggestions[activeIndex])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return <div className="commune-input" ref={wrapperRef}>
    <input
      {...inputProps}
      className={className}
      type="text"
      role="combobox"
      autoComplete="off"
      aria-expanded={expanded}
      aria-controls={listId}
      aria-autocomplete="list"
      aria-activedescendant={expanded && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
      value={value}
      onChange={(event) => { onChange(event.target.value); setOpen(true); setActiveIndex(-1) }}
      onFocus={() => setOpen(true)}
      onKeyDown={handleKeyDown}
    />
    {expanded && <ul className="commune-suggestions" id={listId} role="listbox">
      {suggestions.map((commune, index) => <li
        key={commune}
        id={`${listId}-${index}`}
        role="option"
        aria-selected={index === activeIndex}
        className={index === activeIndex ? 'active' : ''}
        onMouseDown={(event) => { event.preventDefault(); select(commune) }}
        onMouseEnter={() => setActiveIndex(index)}
      >{commune}</li>)}
    </ul>}
  </div>
}
