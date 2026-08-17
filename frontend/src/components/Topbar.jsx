import { Link, useNavigate } from 'react-router-dom';
import LiveClock from './LiveClock';

export default function Topbar({ user, onLogout }) {
  const navigate = useNavigate();

  function logout() {
    onLogout();
    navigate('/login');
  }

  return (
    <div className="topbar">
      <div className="topbar__brand">
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', gap: 10, alignItems: 'baseline' }}>
          <b>BATE-PONTO</b>
          <span>painel escolar</span>
        </Link>
      </div>
      <LiveClock />
      <div className="topbar__user">
        <span>{user?.name} · {user?.role}</span>
        <button className="topbar__logout" onClick={logout}>Sair</button>
      </div>
    </div>
  );
}
