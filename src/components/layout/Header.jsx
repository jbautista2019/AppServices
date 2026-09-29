import { Link } from 'react-router-dom'

export default function Header() {
  return <header className="site-header"><Link to="/" className="brand"><span className="brand-mark">OC</span><span>oficios <i>cerca</i></span></Link><nav><Link to="/buscar">Explorar servicios</Link><Link to="/prestadores">Ofrece tus servicios</Link><Link to="/admin/categorias">Categorías</Link><Link to="/admin/usuarios">Usuarios</Link></nav><div className="header-actions"><button className="icon-button" aria-label="Notificaciones">♧</button><Link className="header-account-link" to="/cuenta">Entrar</Link><Link className="user-button" to="/registro">Crear cuenta <span>→</span></Link></div></header>
}