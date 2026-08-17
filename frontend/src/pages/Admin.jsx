import { useEffect, useState, Fragment } from 'react';
import { api } from '../api';

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const ROLE_LABEL = { aluno: 'Aluno', professor: 'Professor', coordenacao: 'Coordenação' };
const EMPTY_PERSON = { card_id: '', name: '', role: 'aluno', registration: '', login: '', password: '' };

// ==================== PESSOAS ====================
function PeopleTab({ currentUser }) {
  const [people, setPeople] = useState([]);
  const [form, setForm] = useState(EMPTY_PERSON);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    const data = await api.getPeople();
    setPeople(data.people);
  }
  useEffect(() => { load(); }, []);

  function startEdit(p) {
    setEditingId(p.id);
    setForm({ card_id: p.card_id, name: p.name, role: p.role, registration: p.registration || '', login: p.login || '', password: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_PERSON);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (editingId) {
        await api.updatePerson(editingId, form);
      } else {
        await api.createPerson(form);
      }
      cancelEdit();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Excluir esta pessoa? Isso também apaga o histórico de presença, pausas e (se for professor) as aulas em que ela é responsável.')) return;
    try {
      await api.deletePerson(id);
      if (editingId === id) cancelEdit();
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function toggleActive(p) {
    try {
      await api.setPersonActive(p.id, !p.active);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      <div className="card">
        <div className="card__inner">
          {error && <div className="form-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field">
                <label>Cartão (UID)</label>
                <input required value={form.card_id} onChange={(e) => setForm({ ...form, card_id: e.target.value })} />
              </div>
              <div className="field">
                <label>Nome</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="field">
                <label>Papel</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="aluno">Aluno</option>
                  <option value="professor">Professor</option>
                  <option value="coordenacao">Coordenação</option>
                </select>
              </div>
              <div className="field">
                <label>Matrícula (opcional)</label>
                <input value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })} />
              </div>
              {form.role !== 'aluno' && (
                <>
                  <div className="field">
                    <label>Usuário de login</label>
                    <input required value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>{editingId ? 'Nova senha (deixe em branco p/ manter)' : 'Senha'}</label>
                    <input required={!editingId} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </div>
                </>
              )}
            </div>
            <div className="form-actions">
              <button className="btn-primary" type="submit" disabled={loading} style={{ width: 'auto' }}>
                {loading ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Adicionar pessoa'}
              </button>
              {editingId && <button type="button" className="subtle-btn" onClick={cancelEdit}>Cancelar edição</button>}
            </div>
          </form>
        </div>
      </div>

      <div className="card section-gap">
        <div className="card__inner">
          <table className="ledger">
            <thead>
              <tr><th>Nome</th><th>Papel</th><th>Cartão</th><th>Login</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td><span className="role-pill">{ROLE_LABEL[p.role]}</span></td>
                  <td>{p.card_id}</td>
                  <td>{p.login || '—'}</td>
                  <td>
                    {p.role === 'aluno' ? '—' : (
                      <span className={`stamp stamp--${p.active ? 'presente' : 'ausente'}`}>{p.active ? 'ativo' : 'bloqueado'}</span>
                    )}
                  </td>
                  <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="subtle-btn" onClick={() => startEdit(p)}>Editar</button>
                    {p.role !== 'aluno' && p.id !== currentUser?.id && (
                      <button className="subtle-btn" onClick={() => toggleActive(p)}>{p.active ? 'Bloquear' : 'Desbloquear'}</button>
                    )}
                    {p.id !== currentUser?.id && (
                      <button className="delete-btn" onClick={() => handleDelete(p.id)}>Excluir</button>
                    )}
                    {p.id === currentUser?.id && <span className="role-pill">Você</span>}
                  </td>
                </tr>
              ))}
              {people.length === 0 && <tr><td colSpan={6} className="empty-note">Nenhuma pessoa cadastrada.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==================== SALAS ====================
function RoomsTab() {
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState({ name: '', device_token: '' });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    const data = await api.getAdminRooms();
    setRooms(data.rooms);
  }
  useEffect(() => { load(); }, []);

  function startEdit(r) {
    setEditingId(r.id);
    setForm({ name: r.name, device_token: r.device_token });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function cancelEdit() {
    setEditingId(null);
    setForm({ name: '', device_token: '' });
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (editingId) await api.updateRoom(editingId, form);
      else await api.createRoom(form);
      cancelEdit();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Excluir esta sala? Isso também apaga as aulas cadastradas nela e o histórico de presença/pausas ligado a ela.')) return;
    try {
      await api.deleteRoom(id);
      if (editingId === id) cancelEdit();
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      <div className="card">
        <div className="card__inner">
          {error && <div className="form-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field">
                <label>Nome da sala</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Sala 101" />
              </div>
              <div className="field">
                <label>Token do dispositivo (ESP32)</label>
                <input required value={form.device_token} onChange={(e) => setForm({ ...form, device_token: e.target.value })} placeholder="Ex: ESP32-SALA101-TOKEN" />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-primary" type="submit" disabled={loading} style={{ width: 'auto' }}>
                {loading ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Adicionar sala'}
              </button>
              {editingId && <button type="button" className="subtle-btn" onClick={cancelEdit}>Cancelar edição</button>}
            </div>
          </form>
        </div>
      </div>

      <div className="card section-gap">
        <div className="card__inner">
          <table className="ledger">
            <thead><tr><th>Sala</th><th>Token do dispositivo</th><th></th></tr></thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.device_token}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="subtle-btn" onClick={() => startEdit(r)}>Editar</button>
                    <button className="delete-btn" onClick={() => handleDelete(r.id)}>Excluir</button>
                  </td>
                </tr>
              ))}
              {rooms.length === 0 && <tr><td colSpan={3} className="empty-note">Nenhuma sala cadastrada.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==================== MATRÍCULA DE ALUNOS NUMA AULA ====================
function EnrollPanel({ scheduleId }) {
  const [data, setData] = useState(null);

  async function load() {
    const res = await api.getScheduleStudents(scheduleId);
    setData(res);
  }
  useEffect(() => { load(); }, [scheduleId]);

  async function add(personId) {
    try {
      await api.enrollStudent(scheduleId, personId);
      load();
    } catch (err) {
      alert(err.message);
    }
  }
  async function remove(personId) {
    await api.unenrollStudent(scheduleId, personId);
    load();
  }

  if (!data) return <p className="empty-note">Carregando matrícula...</p>;

  return (
    <div className="enroll-panel">
      <div className="enroll-columns">
        <div>
          <h4>Matriculados ({data.enrolled.length})</h4>
          <ul className="enroll-list">
            {data.enrolled.map((s) => (
              <li key={s.id}>{s.name} <button className="delete-btn" onClick={() => remove(s.id)}>Remover</button></li>
            ))}
            {data.enrolled.length === 0 && <li className="empty-note">Nenhum aluno matriculado.</li>}
          </ul>
        </div>
        <div>
          <h4>Disponíveis</h4>
          <ul className="enroll-list">
            {data.available.map((s) => (
              <li key={s.id}>{s.name} <button className="subtle-btn" onClick={() => add(s.id)}>Adicionar</button></li>
            ))}
            {data.available.length === 0 && <li className="empty-note">Todos os alunos já estão matriculados.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ==================== AULAS ====================
const EMPTY_SCHEDULE = { room_id: '', person_id: '', subject: '', weekday: '1', start_time: '08:00', end_time: '09:40', tolerance_minutes: 10 };

function SchedulesTab() {
  const [schedules, setSchedules] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState(EMPTY_SCHEDULE);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);

  async function load() {
    const [schedulesData, roomsData, peopleData] = await Promise.all([
      api.getSchedules(), api.getAdminRooms(), api.getPeople(),
    ]);
    setSchedules(schedulesData.schedules);
    setRooms(roomsData.rooms);
    setTeachers(peopleData.people.filter((p) => p.role === 'professor'));
  }
  useEffect(() => { load(); }, []);

  function startEdit(s) {
    setEditingId(s.id);
    setForm({
      room_id: String(s.room_id), person_id: String(s.person_id), subject: s.subject,
      weekday: String(s.weekday), start_time: s.start_time, end_time: s.end_time,
      tolerance_minutes: s.tolerance_minutes,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_SCHEDULE);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = { ...form, weekday: Number(form.weekday), tolerance_minutes: Number(form.tolerance_minutes) };
      if (editingId) await api.updateSchedule(editingId, payload);
      else await api.createSchedule(payload);
      cancelEdit();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Excluir esta aula? Os alunos matriculados nela também serão desvinculados.')) return;
    try {
      await api.deleteSchedule(id);
      if (expanded === id) setExpanded(null);
      if (editingId === id) cancelEdit();
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      <div className="card">
        <div className="card__inner">
          {error && <div className="form-error">{error}</div>}
          {(rooms.length === 0 || teachers.length === 0) && (
            <p className="empty-note">Cadastre ao menos uma sala e um professor antes de criar uma aula.</p>
          )}
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="field">
                <label>Sala</label>
                <select required value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })}>
                  <option value="">Selecione</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Professor</label>
                <select required value={form.person_id} onChange={(e) => setForm({ ...form, person_id: e.target.value })}>
                  <option value="">Selecione</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Matéria</label>
                <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </div>
              <div className="field">
                <label>Dia da semana</label>
                <select value={form.weekday} onChange={(e) => setForm({ ...form, weekday: e.target.value })}>
                  {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Início</label>
                <input required type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div className="field">
                <label>Fim</label>
                <input required type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
              <div className="field">
                <label>Tolerância (min)</label>
                <input type="number" min="0" value={form.tolerance_minutes} onChange={(e) => setForm({ ...form, tolerance_minutes: e.target.value })} />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-primary" type="submit" disabled={loading || rooms.length === 0 || teachers.length === 0} style={{ width: 'auto' }}>
                {loading ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Adicionar aula'}
              </button>
              {editingId && <button type="button" className="subtle-btn" onClick={cancelEdit}>Cancelar edição</button>}
            </div>
          </form>
        </div>
      </div>

      <div className="card section-gap">
        <div className="card__inner">
          <table className="ledger">
            <thead><tr><th>Sala</th><th>Matéria</th><th>Professor</th><th>Dia</th><th>Horário</th><th></th></tr></thead>
            <tbody>
              {schedules.map((s) => (
                <Fragment key={s.id}>
                  <tr>
                    <td>{s.room_name}</td>
                    <td>{s.subject}</td>
                    <td>{s.teacher_name}</td>
                    <td>{s.weekday_label}</td>
                    <td>{s.start_time}–{s.end_time}</td>
                    <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="subtle-btn" onClick={() => startEdit(s)}>Editar</button>
                      <button className="subtle-btn" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                        {expanded === s.id ? 'Fechar' : 'Alunos'}
                      </button>
                      <button className="delete-btn" onClick={() => handleDelete(s.id)}>Excluir</button>
                    </td>
                  </tr>
                  {expanded === s.id && (
                    <tr>
                      <td colSpan={6}><EnrollPanel scheduleId={s.id} /></td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {schedules.length === 0 && <tr><td colSpan={6} className="empty-note">Nenhuma aula cadastrada.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==================== PÁGINA ====================
export default function Admin({ currentUser }) {
  const [tab, setTab] = useState('people');

  return (
    <div>
      <h2 className="page-title">Cadastros</h2>
      <div className="tabs">
        <button className={`tab ${tab === 'people' ? 'active' : ''}`} onClick={() => setTab('people')}>Pessoas</button>
        <button className={`tab ${tab === 'rooms' ? 'active' : ''}`} onClick={() => setTab('rooms')}>Salas</button>
        <button className={`tab ${tab === 'schedules' ? 'active' : ''}`} onClick={() => setTab('schedules')}>Aulas</button>
      </div>
      {tab === 'people' && <PeopleTab currentUser={currentUser} />}
      {tab === 'rooms' && <RoomsTab />}
      {tab === 'schedules' && <SchedulesTab />}
    </div>
  );
}
