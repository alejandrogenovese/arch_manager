import { useState } from 'react'
import { ARTIFACT_TYPES } from '../constants.js'

export function NewDocModal({ onClose, onSave, defaultType }) {
  const [typeId, setTypeId] = useState(defaultType || 'hld')
  const [title,  setTitle]  = useState('')
  const [domain, setDomain] = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const handleCreate = async () => {
    if (!title.trim()) return
    setSaving(true)
    setError('')
    try {
      await onSave({ type: typeId, title: title.trim(), domain: domain.trim(), sections: {} })
    } catch (err) {
      setError(err.message || 'No se pudo crear el artefacto')
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%', border: '1px solid rgba(0,0,0,0.14)', borderRadius: 8,
    padding: '8px 11px', fontSize: 13, outline: 'none', background: '#FAFAF8',
    boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif',
  }
  const labelStyle = { display: 'block', fontSize: 10, fontWeight: 800, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(13,15,20,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 16, padding: 28, width: 520, maxWidth: '92vw', boxShadow: '0 32px 72px rgba(0,0,0,0.22)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 17, fontWeight: 900, color: '#0D0F14', marginBottom: 20, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.02em' }}>
          Nuevo Artefacto
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Tipo</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ARTIFACT_TYPES.map(t => {
              const active = typeId === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTypeId(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 7, cursor: 'pointer',
                    border: active ? `1.5px solid ${t.color}` : '1.5px solid rgba(0,0,0,0.12)',
                    background: active ? `${t.color}12` : '#FAFAF8',
                    color: active ? t.color : '#374151',
                    fontSize: 12, fontWeight: 700, transition: 'all 0.12s',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.color }} />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Título</label>
          <input
            style={inputStyle}
            placeholder={`Ej: ${typeId === 'adr' ? 'ADR-004 — Formato de contratos de datos' : typeId === 'hld' ? 'HLD — Observabilidad transversal' : 'Título...'}`}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
        </div>

        <div>
          <label style={labelStyle}>Dominio</label>
          <input style={inputStyle} placeholder="ej. Storage, Ingestion…" value={domain} onChange={e => setDomain(e.target.value)} />
        </div>

        {error && (
          <div style={{ marginTop: 14, background: 'rgba(228,0,43,0.07)', border: '1px solid rgba(228,0,43,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#E4002B', fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.07)' }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{ background: 'none', border: '1px solid rgba(0,0,0,0.13)', borderRadius: 7, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: '#374151' }}
          >Cancelar</button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || saving}
            style={{
              background: title.trim() && !saving ? '#E4002B' : '#E5E7EB',
              border: 'none', borderRadius: 7, padding: '8px 22px',
              fontSize: 13, fontWeight: 800,
              cursor: title.trim() && !saving ? 'pointer' : 'default',
              color: title.trim() && !saving ? '#fff' : '#9CA3AF',
              transition: 'all 0.15s',
            }}
          >{saving ? 'Creando…' : 'Crear artefacto'}</button>
        </div>
      </div>
    </div>
  )
}
