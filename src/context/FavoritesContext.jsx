import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { addFavorite, getFavorites, removeFavorite, supabase } from '../utils/supabase'

// Sin proveedor (p. ej. un componente aislado) los favoritos simplemente no hacen nada.
const EMPTY = { loggedIn: false, ids: new Set(), items: [], loading: false, isFavorite: () => false, toggle: async () => {} }
const FavoritesContext = createContext(EMPTY)

export function useFavorites() {
  return useContext(FavoritesContext)
}

// Campos del servicio que necesita la lista de favoritos (los mismos que devuelve getFavorites).
function snapshot(service) {
  return {
    id: service.id,
    title: service.title,
    provider_name: service.provider_name,
    category: service.category,
    location: service.location,
    rating: service.rating,
    starting_price: service.starting_price,
    image_url: service.image_url,
  }
}

// Mantiene los favoritos de la persona con sesión y los comparte con las tarjetas, el detalle y la pestaña del encabezado.
export function FavoritesProvider({ children }) {
  const [userId, setUserId] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const itemsRef = useRef(items)
  itemsRef.current = items

  useEffect(() => {
    if (!supabase) return

    let active = true
    supabase.auth.getSession().then(({ data }) => { if (active) setUserId(data.session?.user?.id || null) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUserId(session?.user?.id || null)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const refresh = useCallback(async () => {
    const { data, error } = await getFavorites()
    if (!error) setItems(data)
  }, [])

  useEffect(() => {
    if (!userId) {
      setItems([])
      return
    }

    let active = true
    setLoading(true)
    getFavorites().then(({ data, error }) => {
      if (!active) return
      if (!error) setItems(data)
      setLoading(false)
    }).catch(() => { if (active) setLoading(false) })

    // Se vuelve a leer al volver a la pestaña por si cambió desde otro dispositivo.
    const onFocus = () => { if (active) refresh() }
    window.addEventListener('focus', onFocus)
    return () => {
      active = false
      window.removeEventListener('focus', onFocus)
    }
  }, [userId, refresh])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 4500)
    return () => clearTimeout(timer)
  }, [notice])

  const ids = useMemo(() => new Set(items.map((item) => String(item.service_id))), [items])

  const toggle = useCallback(async (service) => {
    if (!userId || !service) return
    const key = String(service.id)
    const previous = itemsRef.current
    const wasFavorite = previous.some((item) => String(item.service_id) === key)

    // Respuesta inmediata; si el servidor falla se deshace y se explica.
    setItems(wasFavorite
      ? previous.filter((item) => String(item.service_id) !== key)
      : [{ service_id: service.id, created_at: new Date().toISOString(), services: snapshot(service) }, ...previous])

    const { error } = wasFavorite ? await removeFavorite(userId, service.id) : await addFavorite(userId, service.id)
    if (error) {
      setItems(previous)
      setNotice(error.message)
    }
  }, [userId])

  const value = useMemo(() => ({
    loggedIn: Boolean(userId),
    ids,
    items,
    loading,
    isFavorite: (serviceId) => ids.has(String(serviceId)),
    toggle,
  }), [userId, ids, items, loading, toggle])

  return <FavoritesContext.Provider value={value}>
    {children}
    {notice && <div className="favorites-toast" role="alert">{notice}</div>}
  </FavoritesContext.Provider>
}
