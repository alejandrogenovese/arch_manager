import { useState } from 'react'
import logoUrl from '../assets/galicia-logo.png'
import { auth, ApiError } from '../api.js'

export function LoginScreen({ onLogin }) {
  const [user,    setUser]    = useState('')
  const [pass,    setPass]    = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const me = await auth.login(user.trim().toLowerCase(), pass)
      onLogin(me)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Usuario o contraseña incorrectos.')
      } else {
        setError('Error de conexión. Probá de nuevo.')
      }
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', height: 44, border: '1px solid rgba(0,0,0,0.15)',
    borderRadius: 9, padding: '0 14px', fontSize: 14,
    background: '#FAFAF8', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'DM Sans, sans-serif', color: '#111827',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  return (
    <div style={{ height: '100vh', display: 'flex', background: '#F5F4F1', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: -120, right: -120, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(228,0,43,0.07) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -80, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.06) 0%, transparent 70%)' }} />
      </div>

      <div style={{ width: 400, position: 'relative' }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: '40px 40px 36px', boxShadow: '0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, overflow: 'hidden', flexShrink: 0 }}>
              <img src={logoUrl} alt="Banco Galicia" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#0D0F14', letterSpacing: '-0.03em', fontFamily: 'Outfit, sans-serif' }}>Arch Manager</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500, marginTop: 1 }}>Data Platform · Banco Galicia</div>
            </div>
          </div>

          <div style={{ fontSize: 20, fontWeight: 900, color: '#0D0F14', marginBottom: 4, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.02em' }}>
            Iniciar sesión
          </div>
          <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 28 }}>
            Ingresá con tus credenciales corporativas.
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#374151', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>
                Usuario
              </label>
              <input
                style={inputStyle}
                placeholder="ej. fgarcia"
                value={user}
                onChange={e => setUser(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#374151', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>
                Contraseña
              </label>
              <input
                style={inputStyle}
                type="password"
                placeholder="••••••••"
                value={pass}
                onChange={e => setPass(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div style={{ background: 'rgba(228,0,43,0.07)', border: '1px solid rgba(228,0,43,0.2)', borderRadius: 8, padding: '9px 12px', marginBottom: 16, fontSize: 12, color: '#E4002B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !user || !pass}
              style={{
                width: '100%', height: 44, borderRadius: 9, border: 'none',
                background: user && pass && !loading ? '#E4002B' : '#E5E7EB',
                color: user && pass && !loading ? '#fff' : '#9CA3AF',
                fontSize: 14, fontWeight: 800,
                cursor: user && pass && !loading ? 'pointer' : 'default',
                fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.01em',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? (
                <>
                  <svg style={{ animation: 'spin 0.8s linear infinite' }} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Verificando...
                </>
              ) : 'Ingresar'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#9CA3AF' }}>
          Demo: <code style={{ background: '#F3F4F6', padding: '1px 5px', borderRadius: 4 }}>fgarcia</code> / <code style={{ background: '#F3F4F6', padding: '1px 5px', borderRadius: 4 }}>galicia123</code>
        </div>
      </div>
    </div>
  )
}
