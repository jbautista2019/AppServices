import { Link, useLocation } from 'react-router-dom'

export default function Footer() {
  const location = useLocation()

  return <footer className="site-footer">
    <div className="footer-main">
      <div className="footer-brand-block">
        <Link to="/" className="footer-brand"><span className="footer-brand-mark" aria-hidden="true">⌂</span><span>oficios <i>cerca</i></span></Link>
        <p>Servicios de confianza para tu hogar y tu comunidad.</p>
        <span className="footer-location"><span aria-hidden="true">⌖</span> Santiago, Chile</span>
      </div>
      <nav className="footer-links" aria-label="Enlaces del pie de página">
        <div><h2>Explora</h2><Link to="/buscar">Buscar servicios</Link><Link to="/buscar?category=Hogar">Servicios para el hogar</Link><Link to="/buscar?category=Reparaciones">Reparaciones</Link></div>
        <div><h2>Profesionales</h2><Link to="/prestadores">Ofrece tus servicios</Link><Link to="/registro" state={{ backgroundLocation: location }}>Crear una cuenta</Link></div>
        <div><h2>Tu cuenta</h2><Link to="/cuenta">Iniciar sesión</Link><Link to="/perfil">Mi perfil</Link></div>
      </nav>
    </div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} Oficios Cerca</span><span>Encuentra ayuda confiable, más cerca.</span></div>
  </footer>
}