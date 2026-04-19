import { useEffect, useState } from 'react'
import { audit as auditApi } from '../api.js'

const ACTION_CATEGORIES = [
  { prefix: '',          label: 'Todas' },
  { prefix: 'auth.',     label: 'Auth' },
  { prefix: 'doc.',      label: 'Documentos' },
  { prefix: 'user.',     label: 'Usuarios' },
  { prefix: 'attachment.', label: 'Adjuntos' },
]

const ACTION_COLORS = {
  'auth.login':           '#059669',
  'auth.logout':          '#6B7280',
  'auth.change_password': '#D97706',
  'doc.create':           '#2563EB',
  'doc.update':           '#6B7280',
  'doc.transition':       '#7C3AED',
  'doc.delete':           '#E4002B',
  'doc.restore':          '#059669',
  'user.create':          '#2563EB',
  'user.update':          '#6B7280',
  'user.reset_password':  '#D97706',
  'user.deactivate':      '#E4002B',
  'attachment.add':       '#2563EB',
  'attachment.remove':    '#E4002B',
}

export function AuditLog() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('')
  const [error,   setError]   = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try { setEntries(await auditApi.list({ action: filter, limit: 200 })) }
    catch (err) { setError(err.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [filter])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ padding: '28px 36px', flex: 1, overflowY: 'auto', background: '#F5F4F1' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0D0F14', margin: 0,
                     letterSpacing: '-0.03em', fontFamily: 'Outfit, sans-serif' }}>
          Audit log
        </h1>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>
          Registro append-only de todas las acciones. Últimas 200 entradas.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {ACTION_CATEGORIES.map(cat => (
          <button key={cat.prefix} onClick={() => setFilter(cat.prefix)}
                  style={{ padding: '5px 12px', borderRadius: 20,
                           border: filter === cat.prefix ? 'none' : '1px solid rgba(0,0,0,0.12)',
                           background: filter === cat.prefix ? '#0D0F14' : '#fff',
                           color: filter === cat.prefix ? '#fff' : '#6B7280',
                           fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {cat.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: 'rgba(228,0,43,0.07)',
                      border: '1px solid rgba(228,0,43,0.2)',
                      borderRadius: 8, padding: '10px 14px', marginBottom: 14,
                      fontSize: 12, color: '#E4002B', fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12,
                    border: '1px solid rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        <div style={{ display: 'grid',
                      gridTemplateColumns: '160px 140px 170px 1fr',
                      padding: '10px 20px',
                      background: '#FAFAF8', borderBottom: '1px solid rgba(0,0,0,0.07)',
                      fontSize: 10, fontWeight: 800, color: '#9CA3AF',
                      letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          <span>Fecha/hora</span>
          <span>Actor</span>
          <span>Acción</span>
          <span>Detalle</span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Cargando…</div>
        ) : entries.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Sin entradas</div>
        ) : entries.map((e, i) => {
          const color = ACTION_COLORS[e.action] || '#6B7280'
          const d = new Date(e.at)
          return (
            <div key={e.id}
                 style={{ display: 'grid',
                          gridTemplateColumns: '160px 140px 170px 1fr',
                          alignItems: 'center', padding: '11px 20px',
                          borderBottom: i < entries.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
              <span style={{ fontSize: 11, color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>
                {d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'medium' })}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#111827',
                             overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.actor_name}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color,
                             fontFamily: 'monospace' }}>
                {e.action}
              </span>
              <span style={{ fontSize: 11, color: '#4B5563',
                             fontFamily: e.detail.includes('=') ? 'monospace' : 'inherit',
                             overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={e.detail}>
                {e.doc_id && <code style={{ background: '#F3F4F6', padding: '1px 5px',
                                             borderRadius: 4, fontSize: 10, marginRight: 6 }}>
                  {e.doc_id}
                </code>}
                {e.detail || '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
