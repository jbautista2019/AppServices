import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import Header from '../components/layout/Header'
import AccountPage from '../pages/account/AccountPage'
import AdminUsersPage from '../pages/admin/AdminUsersPage'
import CategoriesAdminPage from '../pages/admin/CategoriesAdminPage'
import HomePage from '../pages/home/HomePage'
import ProvidersPage from '../pages/ProvidersPage'
import SearchPage from '../pages/search/SearchPage'
import ServiceDetailPage from '../pages/services/ServiceDetailPage'
import { getCategories, getPublishedServices, isSupabaseConfigured } from '../lib/supabase'
import '../categoryAdmin.css'

export default function App() {
  const [services, setServices] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [loadError, setLoadError] = useState(isSupabaseConfigured ? '' : 'Configura Supabase para cargar publicaciones.')

  useEffect(() => {
    if (!isSupabaseConfigured) return

    let cancelled = false
    Promise.all([getPublishedServices(), getCategories()]).then(([serviceResult, categoryResult]) => {
      if (cancelled) return
      if (serviceResult.error) setLoadError('No pudimos cargar las publicaciones desde Supabase.')
      else setServices(serviceResult.data || [])
      if (categoryResult.error) setLoadError('No pudimos cargar categorías. Ejecuta el schema.sql actualizado en Supabase.')
      else setCategories(categoryResult.data || [])
      setLoading(false)
    }).catch(() => {
      if (cancelled) return
      setLoadError('No pudimos conectar con Supabase.')
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [])

  return <>
    <Header />
    <Routes>
      <Route path="/" element={<HomePage services={services} categories={categories} loading={loading} />} />
      <Route path="/buscar" element={<SearchPage services={services} categories={categories} loading={loading} loadError={loadError} />} />
      <Route path="/servicio/:id" element={<ServiceDetailPage services={services} loading={loading} loadError={loadError} />} />
      <Route path="/prestadores" element={<ProvidersPage />} />
      <Route path="/cuenta" element={<AccountPage initialMode="login" />} />
      <Route path="/registro" element={<AccountPage initialMode="signup" />} />
      <Route path="/admin/categorias" element={<CategoriesAdminPage />} />
      <Route path="/admin/usuarios" element={<AdminUsersPage />} />
    </Routes>
    <footer><span>oficios <i>cerca</i></span><small>Una forma más humana de encontrar ayuda.</small><span>© 2026</span></footer>
  </>
}