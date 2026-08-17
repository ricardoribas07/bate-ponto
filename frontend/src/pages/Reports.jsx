import { useEffect, useState } from 'react';
import { api } from '../api';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Reports() {
  const [rooms, setRooms] = useState([]);
  const [roomId, setRoomId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getRooms().then((r) => {
      setRooms(r.rooms);
      if (r.rooms.length) setRoomId(String(r.rooms[0].id));
    });
  }, []);

  async function loadReport() {
    if (!roomId) return;
    setError('');
    try {
      const data = await api.getReport(roomId, date);
      setReport(data);
    } catch (err) {
      setError(err.message);
      setReport(null);
    }
  }

  useEffect(() => {
    if (roomId) loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, date]);

  return (
    <div>
      <h2 className="page-title">Nota de presença</h2>

      <div className="select-row">
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        {report?.subject && <button className="print-btn" onClick={() => window.print()}>Imprimir</button>}
      </div>

      {error && <div className="error-box">{error}</div>}

      {report && (
        <div className="card">
          <div className="card__inner">
            {!report.subject ? (
              <p className="empty-note">Não há aula cadastrada para esta sala nesse dia da semana.</p>
            ) : (
              <>
                <div className="room-detail-header">
                  <div>
                    <h2>{report.room} — {report.subject}</h2>
                    <p>{report.date} · Professor(a) {report.teacher} <span className={`stamp stamp--${report.teacher_status}`} style={{ marginLeft: 8 }}>{report.teacher_status}</span></p>
                  </div>
                  <span className="badge-count">{report.presentes} presentes · {report.atrasados} atrasados · {report.ausentes} ausentes</span>
                </div>

                <table className="ledger">
                  <thead>
                    <tr><th>Aluno</th><th>Horário</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {report.students.map((s, i) => (
                      <tr key={i}>
                        <td>{s.name}</td>
                        <td>{s.check_in_time || '--:--:--'}</td>
                        <td><span className={`stamp stamp--${s.status}`}>{s.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
