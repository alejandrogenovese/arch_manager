import { ARTIFACT_TYPES } from '../constants.js'
import { StatusBadge } from './StatusBadge.jsx'

export function Dashboard({ docs, onNavigate, onNew, canCreate }) {
  const recentDocs = [...docs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 7)

  const stats = ARTIFACT_TYPES.map(type => ({
    ...type,
    total:    docs.filter(d => d.type === type.id).length,
    approved: docs.filter(d => d.type === type.id && d.status === 'Approved').length,
    inReview: docs.filter(d => d.type === type.id && d.status === 'In Review').length,
    draft:    docs.filter(d => d.type === type.id && d.status === 'Draft').length,
  }))

  return (
    <div style={{ padding: '28px 36px', flex: 1, overflowY: 'auto', background: '#F5F4F1' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0D0F14', margin: 0, letterSpacing: '-0.03em', fontFamily: 'Outfit, sans-serif' }}>
            Plataforma de Arquitectura
          </h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0', fontWeight: 400 }}>
            Gobierno de decisiones técnicas y artefactos de arquitectura de datos.
          </p>
        </div>
        {canCreate && (
          <button
            style={{
              background: '#E4002B', color: '#fff', border: 'none',
              borderRadius: 8, padding: '10px 18px',
              fontSize: 13, fontWeight: 800, cursor: 'pointer',
              letterSpacing: '-0.01em', fontFamily: 'Outfit, sans-serif',
            }}
            onClick={onNew}
          >+ Nuevo Artefacto</button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { num: docs.length,                                       label: 'Artefactos totales', numColor: '#0D0F14' },
          { num: docs.filter(d => d.status === 'In Review').length, label: 'En revisión',        numColor: '#D97706' },
          { num: docs.filter(d => d.status === 'Approved').length,  label: 'Aprobados',          numColor: '#059669' },
          { num: docs.filter(d => d.status === 'Draft').length,     label: 'Borradores',         numColor: '#6B7280' },
        ].map((kpi, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: kpi.numColor, fontFamily: 'Outfit, sans-serif', lineHeight: 1 }}>{kpi.num}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
        Por tipo de artefacto
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
        {stats.map(stat => (
          <div
            key={stat.id}
            style={{
              background: '#fff', borderRadius: 12, padding: '14px 16px',
              border: '1px solid rgba(0,0,0,0.07)',
              cursor: 'pointer', transition: 'box-shadow 0.2s, border-color 0.2s',
            }}
            onClick={() => onNavigate('list', stat.id)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = stat.color; e.currentTarget.style.boxShadow = `0 0 0 3px ${stat.color}18` }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.07)'; e.currentTarget.style.boxShadow = 'none' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: stat.color, marginTop: 3 }} />
              <span style={{ fontSize: 26, fontWeight: 900, color: '#111827', fontFamily: 'Outfit, sans-serif' }}>{stat.total}</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginTop: 8, lineHeight: 1.2 }}>{stat.label}</div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {stat.approved > 0 && <span style={{ fontSize: 10, color: '#059669', fontWeight: 600 }}>✓ {stat.approved} aprobado{stat.approved !== 1 ? 's' : ''}</span>}
              {stat.inReview > 0 && <span style={{ fontSize: 10, color: '#D97706', fontWeight: 600 }}>● {stat.inReview} en revisión</span>}
              {stat.draft    > 0 && <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>○ {stat.draft} borrador{stat.draft !== 1 ? 'es' : ''}</span>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
        Actividad reciente
      </div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.07)', overflow: 'hidden' }}>
        {recentDocs.map((doc, i) => {
          const type = ARTIFACT_TYPES.find(t => t.id === doc.type)
          return (
            <div
              key={doc.id}
              style={{
                display: 'flex', alignItems: 'center', padding: '12px 20px',
                borderBottom: i < recentDocs.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                cursor: 'pointer', transition: 'background 0.12s', background: '#fff',
              }}
              onClick={() => onNavigate('detail', doc.type, doc.id)}
              onMouseEnter={e => e.currentTarget.style.background = '#FAFAF8'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: type?.color, flexShrink: 0, marginRight: 12 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{doc.author} · {doc.domain}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 16 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: type?.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{type?.shortLabel}</span>
                <StatusBadge status={doc.status} />
                <span style={{ fontSize: 11, color: '#9CA3AF', minWidth: 70, textAlign: 'right' }}>{doc.updatedAt}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
