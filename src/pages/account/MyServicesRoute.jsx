import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '../../utils/supabase'
import MyServicesPage from './MyServicesPage'

export default function MyServicesRoute() {
  const location = useLocation()
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <main className="account-dashboard account-dashboard--compact">
      <section className="account-dashboard-content">
        {authLoading ? <p className="account-dashboard-message">Comprobando sesión...</p> : !isSupabaseConfigured ? <p className="account-dashboard-message" role="status">Configura Supabase para consultar tus servicios.</p> : !session ? <div className="account-dashboard-message">
          <p>Inicia sesión para administrar tus servicios.</p>
          <Link className="account-profile-link" to="/cuenta" state={{ backgroundLocation: location }}>Iniciar sesión <span>→</span></Link>
        </div> : <MyServicesPage userId={session.user.id} />}
      </section>
    </main>
  )
}
