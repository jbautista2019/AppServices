import { useId, useMemo, useState } from 'react'
import { buildSuggestions, clearSearchHistory, getSearchHistory, removeSearchHistory } from '../../utils/searchHistory'

const TYPE_LABELS = { category: 'Categoría', service: 'Servicio' }

// Campo de búsqueda con historial y sugerencias. Debe ir dentro de un contenedor con position: relative (el formulario),
// porque la lista se ancla a él. `onSelect` recibe el texto elegido y el padre decide cómo buscar.
export default function SearchAutocomplete({ value, onChange, onSelect, services = [], categories = [], inputProps = {} }) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [history, setHistory] = useState(() => getSearchHistory())

  const term = value.trim()
  const items = useMemo(() => {
    if (term) return buildSuggestions({ term, history, services, categories })
    return history.map((label) => ({ type: 'history', label }))
  }, [term, history, services, categories])

  const showList = open && items.length > 0

  function openList() {
    setHistory(getSearchHistory())
    setActiveIndex(-1)
    setOpen(true)
  }

  function choose(item) {
    setOpen(false)
    setActiveIndex(-1)
    onSelect(item.label)
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
      return
    }

    if (!showList) {
      if (event.key === 'ArrowDown' && items.length) {
        event.preventDefault()
        openList()
      }
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % items.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index <= 0 ? items.length - 1 : index - 1))
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      choose(items[activeIndex])
    }
  }

  function handleRemove(event, label) {
    event.preventDefault()
    event.stopPropagation()
    setHistory(removeSearchHistory(label))
  }

  function handleClear(event) {
    event.preventDefault()
    setHistory(clearSearchHistory())
  }

  return <div className="search-autocomplete">
    <input
      {...inputProps}
      value={value}
      autoComplete="off"
      role="combobox"
      aria-expanded={showList}
      aria-controls={listId}
      aria-autocomplete="list"
      aria-activedescendant={showList && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
      onChange={(event) => { onChange(event.target.value); setActiveIndex(-1); setOpen(true) }}
      onFocus={openList}
      onBlur={() => { setOpen(false); setActiveIndex(-1) }}
      onKeyDown={handleKeyDown}
    />
    {showList && <div className="search-suggestions" id={listId} role="listbox" aria-label={term ? 'Sugerencias de búsqueda' : 'Búsquedas recientes'} onMouseDown={(event) => event.preventDefault()}>
      {!term && <div className="search-suggestions-heading"><span>Búsquedas recientes</span><button type="button" onClick={handleClear}>Borrar historial</button></div>}
      {items.map((item, index) => <div key={`${item.type}-${item.label}`} id={`${listId}-${index}`} role="option" aria-selected={index === activeIndex} className={index === activeIndex ? 'search-suggestion is-active' : 'search-suggestion'} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(item)}>
        <span className="search-suggestion-icon" aria-hidden="true">{item.type === 'history' ? '↺' : '⌕'}</span>
        <span className="search-suggestion-label">{item.label}</span>
        {item.type === 'history'
          ? <button type="button" className="search-suggestion-remove" aria-label={`Quitar «${item.label}» del historial`} onClick={(event) => handleRemove(event, item.label)}>×</button>
          : <span className="search-suggestion-type">{TYPE_LABELS[item.type]}</span>}
      </div>)}
    </div>}
  </div>
}
