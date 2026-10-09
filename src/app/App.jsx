import { useEffect, useState } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Footer from '../components/layout/Footer'
import Header from '../components/layout/Header'
import LoadingOverlay from '../components/layout/LoadingOverlay'
import AccountPage from '../pages/account/AccountPage'
import MyServicesRoute from '../pages/account/MyServicesRoute'
import ProfilePage from '../pages/account/ProfilePage'
import RegistrationModal from '../pages/account/RegistrationModal'
import AdminReportsPage from '../pages/admin/AdminReportsPage'
import CategoriesAdminPage from '../pages/admin/CategoriesAdminPage'
import HomePage from '../pages/home/HomePage'
import MessagesPage from '../pages/messages/MessagesPage'
import ProvidersPage from '../pages/providers/ProvidersPage'
import SearchPage from '../pages/search/SearchPage'
import ReviewPage from '../pages/reviews/ReviewPage'
import ServiceDetailPage from '../pages/services/ServiceDetailPage'
import CreateServicePage from '../pages/services/CreateServicePage'
import { getCategories, getPublishedServices, isSupabaseConfigured } from '../utils/supabase'

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const registrationOpen = location.pathname === '/registro'
  const loginOpen = location.pathname === '/cuenta'
  const backgroundLocation = location.state?.backgroundLocation
  const pageLocation = registrationOpen || loginOpen
    ? backgroundLocation || { ...location, pathname: '/', search: '', hash: '' }
    : location
  const [services, setServices] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [loadError, setLoadError] = useState(isSupabaseConfigured ? '' : 'Configura Supabase para cargar publicaciones.')

  const refreshServices = location.state?.refreshServices ? location.key : null

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
  }, [refreshServices])

  return <>
    <Header />
    <Routes location={pageLocation}>
      <Route path="/" element={<HomePage services={services} categories={categories} loading={loading} />} />
      <Route path="/buscar" element={<SearchPage services={services} categories={categories} loading={loading} loadError={loadError} />} />
      <Route path="/servicio/nuevo" element={<CreateServicePage categories={categories} />} />
      <Route path="/servicio/:id" element={<ServiceDetailPage services={services} loading={loading} loadError={loadError} />} />
      <Route path="/servicio/:id/editar" element={<ServiceDetailPage services={services} loading={loading} loadError={loadError} />} />
      <Route path="/valorar/:requestId" element={<ReviewPage />} />
      <Route path="/prestadores" element={<ProvidersPage />} />
      <Route path="/perfil" element={<ProfilePage />} />
      <Route path="/mis-servicios" element={<MyServicesRoute />} />
      <Route path="/mensajes" element={<MessagesPage />} />
      <Route path="/admin/categorias" element={<CategoriesAdminPage />} />
      <Route path="/admin/reportes" element={<AdminReportsPage />} />
    </Routes>
    {loginOpen && <AccountPage />}
    {registrationOpen && <RegistrationModal onClose={() => navigate(backgroundLocation ? `${backgroundLocation.pathname}${backgroundLocation.search}${backgroundLocation.hash}` : '/', { replace: true })} />}
    <Footer categories={categories} />
    <LoadingOverlay />
  </>
}