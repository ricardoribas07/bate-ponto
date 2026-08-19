import { Link, useLocation, useNavigate } from 'react-router-dom';
import LiveClock from './LiveClock';

export default function Sidebar({ user, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();

  function logout() {
    onLogout();
    navigate('/login');
  }

  const links = [
    { to: '/', label: 'Painel', match: (p) => p === '/' || p.startsWith('/salas') },
    { to: '/relatorios', label: 'Relatórios', match: (p) => p === '/relatorios' },
  ];
  if (user?.role === 'coordenacao') {
    links.push({ to: '/cadastros', label: 'Cadastros', match: (p) => p === '/cadastros' });
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <b>BATE-PONTO</b>
        <span>painel escolar</span>
      </div>

      <nav className="sidebar__nav">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className={`sidebar__link ${l.match(location.pathname) ? 'active' : ''}`}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="sidebar__footer">
        <LiveClock />
        <div className="sidebar__user">
          <b>{user?.name}</b>
          {user?.role}
        </div>
        <button className="sidebar__logout" onClick={logout}>Sair</button>
      </div>
    </aside>
  );
}
