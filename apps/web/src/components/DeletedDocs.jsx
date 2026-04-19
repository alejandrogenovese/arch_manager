import { useEffect, useState } from 'react'
import { docs as docsApi } from '../api.js'
import { ARTIFACT_TYPES } from '../constants.js'

export function DeletedDocs({ onNavigate, onRestored }) {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try { setItems(await docsApi.list({ only_deleted: true })) }
    catch (err) { setError(err.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleRestore = async (doc) => {
    if (!confirm(`¿Restaurar "${doc.title}"?`)) return
    try {
      const restored = await docsApi.restore(doc.id)
      onRestored?.(restored)
      load()
    } catch (err) { alert(err.message) }
  }

  return (
    <div style={{ padding: '28px 36px', flex: 1, overflowY: 'auto', background: '#F5F4F1' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0D0F14', margin: 0,
                     letterSpacing: '-0.03em', fontFamily: 'Outfit, sans-serif' }}>
          Papelera
        </h1>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>
          Documentos eliminados. Los datos se conservan y se pueden restaurar.
        </p>
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
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Cargando…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.25 }}>🗑️</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>Papelera vacía</div>
          </div>
        ) : items.map((doc, i) => {
          const type = ARTIFACT_TYPES.find(t => t.id === doc.type)
          const deletedDate = doc.deleted_at ? new Date(doc.deleted_at).toLocaleDateString() : ''
          return (
            <div key={doc.id}
                 style={{ display: 'flex', alignItems: 'center', padding: '13px 20px',
                          borderBottom: i < items.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%',
                             background: type?.color, flexShrink: 0, marginRight: 12 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.title}
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                  {doc.author} · {doc.domain || '—'} · Borrado el {deletedDate}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: type?.color,
                               letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {type?.shortLabel}
                </span>
                <button onClick={() => onNavigate('detail', doc.type, doc.id)}
                        style={{ fontSize: 11, fontWeight: 700,
                                 background: 'none', border: '1px solid rgba(0,0,0,0.13)',
                                 borderRadius: 7, padding: '5px 11px', cursor: 'pointer',
                                 color: '#6B7280', marginLeft: 6 }}>
                  Ver
                </button>
                <button onClick={() => handleRestore(doc)}
                        style={{ fontSize: 11, fontWeight: 700,
                                 background: '#059669', border: 'none',
                                 borderRadius: 7, padding: '5px 11px', cursor: 'pointer',
                                 color: '#fff' }}>
                  Restaurar
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
