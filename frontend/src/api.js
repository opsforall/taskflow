// Client API minimaliste. Les appels partent en same-origin sur /api :
// en dev le proxy Vite relaie vers localhost:3000, en prod c'est nginx.

const TOKEN_KEY = 'taskflow_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || 'Une erreur est survenue', res.status);
  }
  return data;
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: () => request('/auth/me'),
  getTasks: () => request('/tasks'),
  createTask: (task) => request('/tasks', { method: 'POST', body: task }),
  updateTask: (id, task) => request(`/tasks/${id}`, { method: 'PUT', body: task }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' })
};
