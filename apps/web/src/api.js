// api.js v2 — cliente HTTP del BFF.

const BASE = '/api'

class ApiError extends Error {
  constructor(status, message, payload) {
    super(message)
    this.status = status
    this.payload = payload
  }
}

async function request(path, { method = 'GET', body, headers = {}, isForm = false, query } = {}) {
  const opts = { method, credentials: 'include', headers: { ...headers } }
  if (body !== undefined) {
    if (isForm) opts.body = body
    else {
      opts.headers['Content-Type'] = 'application/json'
      opts.body = JSON.stringify(body)
    }
  }
  let url = `${BASE}${path}`
  if (query) {
    const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()
    if (qs) url += `?${qs}`
  }
  const res = await fetch(url, opts)
  if (res.status === 204) return null
  const ct = res.headers.get('content-type') || ''
  const payload = ct.includes('application/json') ? await res.json() : await res.text()
  if (!res.ok) {
    const msg = payload?.detail || payload?.message || res.statusText || 'Error'
    throw new ApiError(res.status, msg, payload)
  }
  return payload
}

export const auth = {
  login:          (user, pass)           => request('/auth/login',  { method: 'POST', body: { user, pass } }),
  logout:         ()                     => request('/auth/logout', { method: 'POST' }),
  me:             ()                     => request('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', { method: 'POST', body: { current_password: currentPassword, new_password: newPassword } }),
}

export const docs = {
  list:       (opts = {})                  => request('/docs', { query: opts }),
  get:        (id)                          => request(`/docs/${id}`),
  create:     (payload)                     => request('/docs', { method: 'POST', body: payload }),
  update:     (id, payload)                 => request(`/docs/${id}`, { method: 'PUT',  body: payload }),
  transition: (id, to)                      => request(`/docs/${id}/transition`, { method: 'POST', body: { to } }),
  delete:     (id)                          => request(`/docs/${id}`, { method: 'DELETE' }),
  restore:    (id)                          => request(`/docs/${id}/restore`, { method: 'POST' }),
}

export const attachments = {
  upload: (docId, file) => {
    const fd = new FormData()
    fd.append('file', file)
    return request(`/docs/${docId}/attachments`, { method: 'POST', body: fd, isForm: true })
  },
  remove: (id) => request(`/attachments/${id}`, { method: 'DELETE' }),
  url:    (id) => `${BASE}/attachments/${id}`,
}

export const users = {
  list:          ()          => request('/users'),
  get:           (id)        => request(`/users/${id}`),
  create:        (payload)   => request('/users', { method: 'POST', body: payload }),
  update:        (id, p)     => request(`/users/${id}`, { method: 'PATCH', body: p }),
  resetPassword: (id)        => request(`/users/${id}/reset-password`, { method: 'POST' }),
  deactivate:    (id)        => request(`/users/${id}`, { method: 'DELETE' }),
}

export const audit = {
  list: (opts = {}) => request('/audit', { query: opts }),
}

export { ApiError }
