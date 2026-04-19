import { useState } from 'react'
import { auth, ApiError } from '../api.js'

/**
 * Full-screen, bloqueante. Se muestra cuando el usuario tiene
 * must_change_password=true. No hay logout desde acá — el único camino
 * para salir es completar el cambio (o cerrar el browser).
 */
export function ChangePasswordScreen({ user, onChanged }) {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw,     setNewPw]     = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)

  const rules = {
    length:  newPw.length >= 10,
    diff:    newPw && newPw !== currentPw,
    match:   newPw && newPw === confirmPw,
  }
  const allOk = rules.length && rules.diff && rules.match

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!allOk) return
    setLoading(true)
    try {
      const me = await auth.changePassword(currentPw, newPw)
      onChanged(me)
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else setError('Error de conexión.')
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', height: 40, border: '1px solid rgba(0,0,0,0.15)',
    borderRadius: 8, padding: '0 12px', fontSize: 13, background: '#FAFAF8',
    outline: 'none', boxSizing: 'border-box',
    fontFamily: 'DM Sans, sans-serif', color: '#111827',
  }

  const ruleItem = (ok, text) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
                  color: ok ? '#059669' : '#9CA3AF', marginBottom: 3 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%',
                     background: ok ? '#059669' : '#D1D5DB' }} />
      {text}
    </div>
  )

  return (
    <div style={{ height: '100vh', display: 'flex', background: '#F5F4F1',
                  alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 440, background: '#fff', borderRadius: 20,
                    padding: '36px 36px 32px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(0,0,0,0.08)',
                    border: '1px solid rgba(0,0,0,0.06)' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%',
                        background: 'rgba(217,119,6,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" fill="none" stroke="#D97706" strokeWidth="2.2" viewBox="0 0 24 24">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#0D0F14',
                          fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.02em' }}>
              Cambio de contraseña requerido
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
              Hola {user.name}. Necesitás elegir una contraseña nueva para continuar.
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 800,
                          color: '#374151', letterSpacing: '0.07em',
                          textTransform: 'uppercase', marginBottom: 5 }}>
            Contraseña actual
          </label>
          <input type="password" style={{ ...inputStyle, marginBottom: 14 }}
                 value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                 autoFocus autoComplete="current-password" />

          <label style={{ display: 'block', fontSize: 10, fontWeight: 800,
                          color: '#374151', letterSpacing: '0.07em',
                          textTransform: 'uppercase', marginBottom: 5 }}>
            Nueva contraseña
          </label>
          <input type="password" style={{ ...inputStyle, marginBottom: 8 }}
                 value={newPw} onChange={e => setNewPw(e.target.value)}
                 autoComplete="new-password" />

          <div style={{ marginBottom: 14 }}>
            {ruleItem(rules.length, 'Al menos 10 caracteres')}
            {ruleItem(rules.diff,   'Distinta a la actual')}
          </div>

          <label style={{ display: 'block', fontSize: 10, fontWeight: 800,
                          color: '#374151', letterSpacing: '0.07em',
                          textTransform: 'uppercase', marginBottom: 5 }}>
            Repetir nueva contraseña
          </label>
          <input type="password" style={{ ...inputStyle, marginBottom: 8 }}
                 value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                 autoComplete="new-password" />

          <div style={{ marginBottom: 16 }}>
            {ruleItem(rules.match, 'Las contraseñas coinciden')}
          </div>

          {error && (
            <div style={{ background: 'rgba(228,0,43,0.07)',
                          border: '1px solid rgba(228,0,43,0.2)',
                          borderRadius: 8, padding: '9px 12px', marginBottom: 14,
                          fontSize: 12, color: '#E4002B', fontWeight: 600 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={!allOk || loading}
                  style={{
                    width: '100%', height: 42, borderRadius: 9, border: 'none',
                    background: allOk && !loading ? '#E4002B' : '#E5E7EB',
                    color: allOk && !loading ? '#fff' : '#9CA3AF',
                    fontSize: 13, fontWeight: 800,
                    cursor: allOk && !loading ? 'pointer' : 'default',
                    fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.01em',
                    transition: 'all 0.15s',
                  }}>
            {loading ? 'Cambiando…' : 'Cambiar contraseña y continuar'}
          </button>
        </form>

        <div style={{ marginTop: 14, fontSize: 10, color: '#9CA3AF',
                      textAlign: 'center', lineHeight: 1.5 }}>
          Por seguridad, todas tus otras sesiones activas se cerrarán al completar el cambio.
        </div>
      </div>
    </div>
  )
}
