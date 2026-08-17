const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function getToken() {
  return localStorage.getItem('bp_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  let data = {};
  let parseFailed = false;
  try {
    data = await res.json();
  } catch (e) {
    parseFailed = true;
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('bp_token');
      window.dispatchEvent(new CustomEvent('bp_unauthorized', { detail: data.error }));
    }
    if (parseFailed) {
      // Resposta não era JSON (ex: HTML de erro 404) — normalmente indica que o
      // backend rodando está desatualizado ou fora do ar nessa rota.
      throw new Error(`O backend respondeu de forma inesperada (HTTP ${res.status}) em ${path}. Verifique se o backend foi atualizado e reiniciado.`);
    }
    throw new Error(data.error || 'Erro na requisição');
  }
  return data;
}

export const api = {
  login: (login, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) }),
  getRooms: () => request('/rooms'),
  getRoomStatus: (id) => request(`/rooms/${id}/status`),
  getAlerts: () => request('/alerts'),
  getReport: (roomId, date) => request(`/reports/${roomId}/${date}`),

  // ---- Cadastros (coordenação) ----
  getPeople: () => request('/admin/people'),
  createPerson: (data) => request('/admin/people', { method: 'POST', body: JSON.stringify(data) }),
  updatePerson: (id, data) => request(`/admin/people/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setPersonActive: (id, active) => request(`/admin/people/${id}/active`, { method: 'PATCH', body: JSON.stringify({ active }) }),
  deletePerson: (id) => request(`/admin/people/${id}`, { method: 'DELETE' }),

  getAdminRooms: () => request('/admin/rooms'),
  createRoom: (data) => request('/admin/rooms', { method: 'POST', body: JSON.stringify(data) }),
  updateRoom: (id, data) => request(`/admin/rooms/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRoom: (id) => request(`/admin/rooms/${id}`, { method: 'DELETE' }),

  getSchedules: () => request('/admin/schedules'),
  createSchedule: (data) => request('/admin/schedules', { method: 'POST', body: JSON.stringify(data) }),
  updateSchedule: (id, data) => request(`/admin/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSchedule: (id) => request(`/admin/schedules/${id}`, { method: 'DELETE' }),

  getScheduleStudents: (id) => request(`/admin/schedules/${id}/students`),
  enrollStudent: (scheduleId, personId) =>
    request(`/admin/schedules/${scheduleId}/students`, { method: 'POST', body: JSON.stringify({ person_id: personId }) }),
  unenrollStudent: (scheduleId, personId) =>
    request(`/admin/schedules/${scheduleId}/students/${personId}`, { method: 'DELETE' }),
};

export { getToken };
