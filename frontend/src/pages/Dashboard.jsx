import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

function StatusStamp({ status }) {
  if (!status) return <span className="stamp stamp--aguardando">sem aula</span>;
  return <span className={`stamp stamp--${status}`}>{status}</span>;
}

export default function Dashboard() {
  const [rooms, setRooms] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function load() {
    try {
      const [roomsData, alertsData] = await Promise.all([api.getRooms(), api.getAlerts()]);
      setRooms(roomsData.rooms);
      setAlerts(alertsData.alerts);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <h2 className="page-title">Alertas</h2>
      {error && <div className="error-box">{error}</div>}
      {alerts.length === 0 && <p className="empty-note">Nenhum alerta no momento.</p>}
      {alerts.map((a, i) => (
        <div className={`alert alert--${a.severity === 'alta' ? 'alta' : 'media'}`} key={i}>
          <div>
            <span className="alert__tag">{a.type === 'professor_ausente' ? 'Professor ausente' : 'Pausa excedida'} · {a.room}</span>
            <p>{a.message}</p>
          </div>
        </div>
      ))}

      <h2 className="page-title section-gap">Salas</h2>
      <div className="room-grid">
        {rooms.map((r) => (
          <div className="card room-card" key={r.id} onClick={() => navigate(`/salas/${r.id}`)}>
            <div className="card__inner">
              <div className="room-card__header">
                <div>
                  <div className="room-card__name">{r.name}</div>
                  <div className="room-card__subject">{r.has_class_now ? r.subject : 'Sem aula agora'}</div>
                </div>
                <StatusStamp status={r.teacher_status} />
              </div>

              {r.has_class_now && (
                <div className="room-card__teacher">
                  Professor(a): <b>{r.teacher}</b> · {r.start_time}–{r.end_time}
                </div>
              )}

              <div className="room-card__stats">
                <div className="stat stat--presente">
                  <span className="stat__n">{r.presentes}</span>
                  <span className="stat__l">Presentes</span>
                </div>
                <div className="stat stat--atrasado">
                  <span className="stat__n">{r.atrasados}</span>
                  <span className="stat__l">Atrasados</span>
                </div>
                <div className="stat stat--ausente">
                  <span className="stat__n">{r.ausentes}</span>
                  <span className="stat__l">Ausentes</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
