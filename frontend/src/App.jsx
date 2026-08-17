import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RoomDetail from './pages/RoomDetail';
import Reports from './pages/Reports';
import Admin from './pages/Admin';
import Topbar from './components/Topbar';
import { getToken } from './api';

function Shell({ user, onLogout }) {
  const location = useLocation();
  return (
    <div className="app-shell">
      <Topbar user={user} onLogout={onLogout} />
      <div className="main">
        <div className="tabs">
          <Link to="/" className={`tab ${location.pathname === '/' || location.pathname.startsWith('/salas') ? 'active' : ''}`}>Painel</Link>
          <Link to="/relatorios" className={`tab ${location.pathname === '/relatorios' ? 'active' : ''}`}>Relatórios</Link>
          {user?.role === 'coordenacao' && (
            <Link to="/cadastros" className={`tab ${location.pathname === '/cadastros' ? 'active' : ''}`}>Cadastros</Link>
          )}
        </div>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/salas/:id" element={<RoomDetail />} />
          <Route path="/relatorios" element={<Reports />} />
          {user?.role === 'coordenacao' && <Route path="/cadastros" element={<Admin currentUser={user} />} />}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);

  function handleLogout() {
    localStorage.removeItem('bp_token');
    setUser(null);
  }

  useEffect(() => {
    if (!getToken()) localStorage.removeItem('bp_token');
    setChecked(true);

    function onUnauthorized() {
      handleLogout();
    }
    window.addEventListener('bp_unauthorized', onUnauthorized);
    return () => window.removeEventListener('bp_unauthorized', onUnauthorized);
  }, []);

  if (!checked) return null;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login onLogin={setUser} />} />
        <Route
          path="/*"
          element={user ? <Shell user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
      </Routes>
    </BrowserRouter>
  );
}
