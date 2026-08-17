import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Login({ onLogin }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(login, password);
      localStorage.setItem('bp_token', data.token);
      onLogin(data.user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="card login-card">
        <div className="card__inner">
          <h1 className="login-title">BATE-PONTO</h1>
          <p className="login-sub">Acesso da coordenação e professores</p>

          {error && <div className="form-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="login">Usuário</label>
              <input id="login" value={login} onChange={(e) => setLogin(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label htmlFor="password">Senha</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="login-hint">
            Demo: coordenacao / admin123 &nbsp;·&nbsp; maria / 123456 &nbsp;·&nbsp; joao / 123456
          </div>
        </div>
      </div>
    </div>
  );
}
