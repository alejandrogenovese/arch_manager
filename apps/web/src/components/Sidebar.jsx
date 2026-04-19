import logoUrl from '../assets/galicia-logo.png'
import { ARTIFACT_TYPES, ROLE_LABELS } from '../constants.js'

export function Sidebar({ currentView, currentType, onNavigate, docs, currentUser, onLogout }) {
  const typeCounts = ARTIFACT_TYPES.reduce((acc, t) => {
    acc[t.id] = docs.filter(d => d.type === t.id).length
    return acc
  }, {})
  const pendingReview = docs.filter(d => d.status === 'In Review').length
  const isAdmin = currentUser?.role === 'admin'

  const navItemStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '7px 12px', borderRadius: 7,
    background: active ? 'rgba(228,0,43,0.13)' : 'transparent',
    border: 'none', color: active ? '#F87171' : '#9CA3AF',
    cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 500,
    width: '100%', textAlign: 'left', transition: 'all 0.15s',
  })

  const sectionLabelStyle = {
    fontSize: 9.5, fontWeight: 800, color: '#374151', letterSpacing: '0.12em',
    padding: '14px 20px 5px', textTransform: 'uppercase',
  }

  return (
    <aside style={{ width: 232, minWidth: 232, background: '#0D0F14',
                    display: 'flex', flexDirection: 'column',
                    borderRight: '1px solid rgba(255,255,255,0.05)' }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10,
                    padding: '18px 16px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: 30, height: 30, borderRadius: 7, overflow: 'hidden', flexShrink: 0 }}>
          <img src={logoUrl} alt="Banco Galicia" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#F9FAFB',
                        letterSpacing: '-0.02em', fontFamily: 'Outfit, sans-serif' }}>
            Arch Manager
          </div>
          <div style={{ fontSize: 10, color: '#4B5563', marginTop: 1, fontWeight: 500 }}>
            Data · Galicia
          </div>
        </div>
      </div>

      <div style={{ padding: '10px 8px 0' }}>
        <button style={navItemStyle(currentView === 'dashboard')} onClick={() => onNavigate('dashboard')}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          Dashboard
        </button>
      </div>

      <div style={sectionLabelStyle}>Artefactos</div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '0 8px' }}>
        {ARTIFACT_TYPES.map(type => {
          const active = currentView === 'list' && currentType === type.id
          return (
            <button key={type.id} style={navItemStyle(active)} onClick={() => onNavigate('list', type.id)}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: type.color, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{type.label}</span>
              <span style={{ background: 'rgba(255,255,255,0.07)', color: '#4B5563',
                             fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
                {typeCounts[type.id] || 0}
              </span>
            </button>
          )
        })}
      </nav>

      {/* Sección Admin */}
      {isAdmin && (
        <>
          <div style={sectionLabelStyle}>Administración</div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '0 8px' }}>
            <button style={navItemStyle(currentView === 'admin-users')} onClick={() => onNavigate('admin-users')}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Usuarios
            </button>
            <button style={navItemStyle(currentView === 'admin-deleted')} onClick={() => onNavigate('admin-deleted')}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
              </svg>
              Papelera
            </button>
            <button style={navItemStyle(currentView === 'admin-audit')} onClick={() => onNavigate('admin-audit')}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              Audit log
            </button>
          </nav>
        </>
      )}

      <div style={{ flex: 1 }} />

      <div style={{ margin: '0 10px 10px', background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 9, padding: '10px 12px' }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: '#4B5563',
                      letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>
          Separar el verbo
        </div>
        {[
          { verb: 'Decidís',  artifact: 'ADR',       color: '#E4002B' },
          { verb: 'Pedís',    artifact: 'HLD + CAP', color: '#2563EB' },
          { verb: 'Negociás', artifact: 'RFC',       color: '#7C3AED' },
        ].map(row => (
          <div key={row.verb} style={{ display: 'flex', alignItems: 'center',
                                        justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: '#6B7280' }}>{row.verb}</span>
            <span style={{ fontSize: 9, fontWeight: 800, color: row.color,
                           letterSpacing: '0.06em' }}>{row.artifact}</span>
          </div>
        ))}
      </div>

      {pendingReview > 0 && (
        <div style={{ margin: '0 10px 10px', background: 'rgba(217,119,6,0.1)',
                      border: '1px solid rgba(217,119,6,0.22)',
                      borderRadius: 9, padding: '8px 12px', fontSize: 11,
                      color: '#FCD34D', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FCD34D', flexShrink: 0 }} />
          {pendingReview} pendiente{pendingReview > 1 ? 's' : ''} de revisión
        </div>
      )}

      {currentUser && (
        <div style={{ margin: '0 10px 12px', background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 9, padding: '10px 12px',
                      display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        background: '#E4002B',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 900, color: '#fff',
                        fontFamily: 'Outfit, sans-serif' }}>
            {currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#E5E7EB',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser.name}
            </div>
            <div style={{ fontSize: 9, color: '#4B5563', marginTop: 1 }}>
              {ROLE_LABELS[currentUser.role] || currentUser.role}
            </div>
          </div>
          <button onClick={onLogout} title="Cerrar sesión"
                  style={{ background: 'none', border: 'none', cursor: 'pointer',
                           padding: 4, color: '#4B5563', borderRadius: 5, display: 'flex' }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      )}
    </aside>
  )
}
