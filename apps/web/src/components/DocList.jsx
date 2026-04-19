import { useState } from 'react'
import { ARTIFACT_TYPES, STATUS_CONFIG } from '../constants.js'
import { StatusBadge } from './StatusBadge.jsx'

export function DocList({ docs, typeId, onNavigate, onNew, canCreate }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  const type = ARTIFACT_TYPES.find(t => t.id === typeId)

  const filtered = docs
    .filter(d => d.type === typeId)
    .filter(d => statusFilter === 'all' || d.status === statusFilter)
    .filter(d => !search || d.title.toLowerCase().includes(search.toLowerCase()) || d.author.toLowerCase().includes(search.toLowerCase()) || d.domain.toLowerCase().includes(search.toLowerCase()))

  const filterBtnStyle = (active) => ({
    padding: '5px 12px', borderRadius: 20,
    border: active ? 'none' : '1px solid rgba(0,0,0,0.12)',
    background: active ? '#0D0F14' : '#fff',
    color: active ? '#fff' : '#6B7280',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    transition: 'all 0.12s',
  })

  return (
    <div style={{ padding: '28px 36px', flex: 1, overflowY: 'auto', background: '#F5F4F1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: type?.color }} />
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0D0F14', margin: 0, letterSpacing: '-0.03em', fontFamily: 'Outfit, sans-serif' }}>
            {type?.label}
          </h1>
          <span style={{ background: `${type?.color}18`, color: type?.color, fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 20 }}>
            {docs.filter(d => d.type === typeId).length}
          </span>
        </div>
        {canCreate && (
          <button
            style={{ background: '#E4002B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
            onClick={() => onNew(typeId)}
          >+ Nuevo {type?.shortLabel}</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            style={{ width: '100%', height: 36, paddingLeft: 30, paddingRight: 12, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, fontSize: 13, background: '#fff', outline: 'none', boxSizing: 'border-box' }}
            placeholder="Buscar por título, autor o dominio..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={filterBtnStyle(statusFilter === 'all')} onClick={() => setStatusFilter('all')}>Todos</button>
          {['Draft', 'In Review', 'Approved', 'Deprecated'].map(s => (
            <button key={s} style={filterBtnStyle(statusFilter === s)} onClick={() => setStatusFilter(s)}>
              {STATUS_CONFIG[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF', background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.25 }}>◫</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#6B7280' }}>No hay artefactos</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {search || statusFilter !== 'all' ? 'Probá con otros filtros.' : 'Creá el primero.'}
          </div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.07)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 120px 100px', padding: '9px 20px', background: '#FAFAF8', borderBottom: '1px solid rgba(0,0,0,0.07)', fontSize: 10, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            <span>Título</span>
            <span>Dominio</span>
            <span>Autor</span>
            <span>Estado</span>
            <span style={{ textAlign: 'right' }}>Actualizado</span>
          </div>
          {filtered.map((doc, i) => (
            <div
              key={doc.id}
              style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 120px 100px', alignItems: 'center', padding: '13px 20px', borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', transition: 'background 0.12s', background: '#fff' }}
              onClick={() => onNavigate('detail', doc.type, doc.id)}
              onMouseEnter={e => e.currentTarget.style.background = '#FAFAF8'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: type?.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</span>
              </div>
              <span style={{ fontSize: 12, color: '#6B7280' }}>{doc.domain || '—'}</span>
              <span style={{ fontSize: 12, color: '#6B7280' }}>{doc.author}</span>
              <span><StatusBadge status={doc.status} /></span>
              <span style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'right' }}>{doc.updatedAt}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
