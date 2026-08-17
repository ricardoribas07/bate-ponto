import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';

const BREAK_LABEL = { urinar: 'banheiro (urinar)', defecar: 'banheiro (defecar)', agua: 'tomar água', garrafa: 'encher garrafa' };

export default function RoomDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const res = await api.getRoomStatus(id);
      setData(res);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <div className="error-box">{error}</div>;
  if (!data) return <div className="loading">Carregando...</div>;

  const { room, students, breaks_in_progress } = data;

  return (
    <div>
      <button className="back-link" onClick={() => navigate('/')}>← Voltar</button>

      <div className="room-detail-header">
        <div>
          <h2>{room.name}</h2>
          <p>{room.has_class_now ? `${room.subject} · Professor(a) ${room.teacher} · ${room.start_time}–${room.end_time}` : 'Nenhuma aula ativa nesta sala agora'}</p>
        </div>
        <span className="badge-count">{room.presentes} presentes · {room.atrasados} atrasados · {room.ausentes} ausentes</span>
      </div>

      {breaks_in_progress?.length > 0 && (
        <div className="breaks-strip">
          {breaks_in_progress.map((b) => (
            <div className="break-chip" key={b.id}>
              {b.name} — fora desde {b.start_time.slice(0, 5)} ({BREAK_LABEL[b.type] || b.type})
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card__inner">
          <table className="ledger">
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Horário</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr><td colSpan={3} className="empty-note">Sem alunos matriculados nesta turma.</td></tr>
              )}
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.check_in_time || '--:--:--'}</td>
                  <td><span className={`stamp stamp--${s.status}`}>{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
