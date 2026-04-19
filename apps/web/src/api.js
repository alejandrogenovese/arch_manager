// api.js — cliente HTTP del BFF.
//
// Todas las llamadas usan `credentials: 'include'` para que la cookie
// HttpOnly de sesión viaje. NO leemos ni escribimos tokens en el cliente
// (eso es justamente el punto del patrón BFF).

const BASE = '/api'

class ApiError extends Error {
  constructor(status, message, payload) {
    super(message)
    this.status = status
    this.payload = payload
  }
}

async function request(path, { method = 'GET', body, headers = {}, isForm = false } = {}) {
  const opts = {
    method,
    credentials: 'include',
    headers: { ...headers },
  }
  if (body !== undefined) {
    if (isForm) {
      opts.body = body  // FormData
    } else {
      opts.headers['Content-Type'] = 'application/json'
      opts.body = JSON.stringify(body)
    }
  }
  const res = await fetch(`${BASE}${path}`, opts)
  if (res.status === 204) return null
  let payload = null
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    payload = await res.json()
  } else {
    payload = await res.text()
  }
  if (!res.ok) {
    const msg = payload?.detail || payload?.message || res.statusText || 'Error'
    throw new ApiError(res.status, msg, payload)
  }
  return payload
}

// ─── Auth ────────────────────────────────────────────────────────────────────
export const auth = {
  login:  (user, pass) => request('/auth/login', { method: 'POST', body: { user, pass } }),
  logout: ()           => request('/auth/logout', { method: 'POST' }),
  me:     ()           => request('/auth/me'),
}

// ─── Docs ────────────────────────────────────────────────────────────────────
export const docs = {
  list:       ()                       => request('/docs'),
  get:        (id)                     => request(`/docs/${id}`),
  create:     (payload)                => request('/docs', { method: 'POST', body: payload }),
  update:     (id, payload)            => request(`/docs/${id}`,             { method: 'PUT',  body: payload }),
  transition: (id, to)                 => request(`/docs/${id}/transition`,  { method: 'POST', body: { to } }),
}

// ─── Attachments ────────────────────────────────────────────────────────────
export const attachments = {
  upload: (docId, file) => {
    const fd = new FormData()
    fd.append('file', file)
    return request(`/docs/${docId}/attachments`, { method: 'POST', body: fd, isForm: true })
  },
  remove: (id) => request(`/attachments/${id}`, { method: 'DELETE' }),
  url:    (id) => `${BASE}/attachments/${id}`,
}

export { ApiError }
