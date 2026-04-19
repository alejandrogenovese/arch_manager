import { useEffect, useState } from 'react'
import { users as usersApi, ApiError } from '../api.js'
import { ALL_ROLES, ROLE_LABELS } from '../constants.js'

export function AdminUsers({ currentUser }) {
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [showNew,  setShowNew]  = useState(false)
  const [tempPwFor, setTempPwFor] = useState(null)   // { user, password }

  const load = async () => {
    setLoading(true); setError('')
    try { setUsers(await usersApi.list()) }
    catch (err) { setError(err.message || 'Error') }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handleCreated = (created) => {
    setShowNew(false)
    setTempPwFor({ user: created, password: created.temporary_password })
    load()
  }

  const handleChangeRole = async (user, newRole) => {
    try { await usersApi.update(user.id, { role: newRole }); load() }
    catch (err) { alert(err.message) }
  }

  const handleToggleActive = async (user) => {
    try {
      if (user.active) await usersApi.deactivate(user.id)
      else await usersApi.update(user.id, { active: true })
      load()
    } catch (err) { alert(err.message) }
  }

  const handleResetPassword = async (user) => {
    if (!confirm(`¿Resetear la contraseña de ${user.full_name}? Todas sus sesiones activas se cerrarán.`)) return
    try {
      const { temporary_password } = await usersApi.resetPassword(user.id)
      setTempPwFor({ user, password: temporary_password })
      load()
    } catch (err) { alert(err.message) }
  }

  return (
    <div style={{ padding: '28px 36px', flex: 1, overflowY: 'auto', background: '#F5F4F1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0D0F14', margin: 0,
                       letterSpacing: '-0.03em', fontFamily: 'Outfit, sans-serif' }}>
            Usuarios
          </h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>
            Gestión de usuarios y roles. Las contraseñas son temporales al crear o resetear.
          </p>
        </div>
        <button onClick={() => setShowNew(true)}
                style={{ background: '#E4002B', color: '#fff', border: 'none',
                         borderRadius: 8, padding: '9px 16px',
                         fontSize: 13, fontWeight: 800, cursor: 'pointer',
                         fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.01em' }}>
          + Nuevo Usuario
        </button>
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
                      gridTemplateColumns: '1fr 140px 130px 120px 110px 190px',
                      padding: '10px 20px',
                      background: '#FAFAF8', borderBottom: '1px solid rgba(0,0,0,0.07)',
                      fontSize: 10, fontWeight: 800, color: '#9CA3AF',
                      letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          <span>Usuario</span>
          <span>Username</span>
          <span>Rol</span>
          <span>Estado</span>
          <span>Último login</span>
          <span style={{ textAlign: 'right' }}>Acciones</span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Cargando…</div>
        ) : users.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Sin usuarios</div>
        ) : users.map((u, i) => {
          const isSelf = u.id === currentUser.id
          return (
            <div key={u.id}
                 style={{ display: 'grid',
                          gridTemplateColumns: '1fr 140px 130px 120px 110px 190px',
                          alignItems: 'center', padding: '13px 20px',
                          borderBottom: i < users.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                          opacity: u.active ? 1 : 0.55 }}>
              {/* Usuario */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                              background: '#0D0F14', color: '#fff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, fontWeight: 900, fontFamily: 'Outfit, sans-serif' }}>
                  {u.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827',
                               overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.full_name}
                  {isSelf && <span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 6, fontWeight: 500 }}>(vos)</span>}
                  {u.must_change_password && <span style={{ fontSize: 10, color: '#D97706', marginLeft: 6, fontWeight: 700 }}>🔑</span>}
                </span>
              </div>
              {/* Username */}
              <span style={{ fontSize: 12, color: '#6B7280' }}>{u.username}</span>
              {/* Rol (dropdown) */}
              <select value={u.role}
                      disabled={isSelf}
                      onChange={e => handleChangeRole(u, e.target.value)}
                      style={{ fontSize: 11, border: '1px solid rgba(0,0,0,0.12)',
                               borderRadius: 6, padding: '4px 8px', background: '#fff',
                               color: '#111827', cursor: isSelf ? 'not-allowed' : 'pointer',
                               opacity: isSelf ? 0.6 : 1 }}>
                {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              {/* Estado */}
              <span style={{ fontSize: 11, fontWeight: 700,
                             color: u.active ? '#059669' : '#9CA3AF' }}>
                {u.active ? '● Activo' : '○ Inactivo'}
              </span>
              {/* Último login */}
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : '—'}
              </span>
              {/* Acciones */}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => handleResetPassword(u)}
                        disabled={!u.active}
                        title="Reset password"
                        style={{ fontSize: 10, fontWeight: 700,
                                 background: 'none', border: '1px solid rgba(0,0,0,0.13)',
                                 borderRadius: 6, padding: '4px 9px', cursor: 'pointer',
                                 color: '#6B7280', opacity: u.active ? 1 : 0.4 }}>
                  Reset PW
                </button>
                <button onClick={() => handleToggleActive(u)}
                        disabled={isSelf}
                        style={{ fontSize: 10, fontWeight: 700,
                                 background: 'none',
                                 border: `1px solid ${u.active ? 'rgba(228,0,43,0.25)' : 'rgba(5,150,105,0.25)'}`,
                                 borderRadius: 6, padding: '4px 9px',
                                 cursor: isSelf ? 'not-allowed' : 'pointer',
                                 color: u.active ? '#E4002B' : '#059669',
                                 opacity: isSelf ? 0.4 : 1 }}>
                  {u.active ? 'Desactivar' : 'Reactivar'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {showNew && <NewUserModal onClose={() => setShowNew(false)} onCreated={handleCreated} />}
      {tempPwFor && <TempPasswordModal data={tempPwFor} onClose={() => setTempPwFor(null)} />}
    </div>
  )
}

function NewUserModal({ onClose, onCreated }) {
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [role,     setRole]     = useState('arq_datos')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const submit = async (e) => {
    e?.preventDefault()
    if (!username.trim() || !fullName.trim()) return
    setSaving(true); setError('')
    try {
      const created = await usersApi.create({
        username: username.trim().toLowerCase(),
        full_name: fullName.trim(),
        role,
      })
      onCreated(created)
    } catch (err) {
      setError(err.message || 'No se pudo crear')
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%', border: '1px solid rgba(0,0,0,0.14)', borderRadius: 8,
    padding: '8px 11px', fontSize: 13, outline: 'none', background: '#FAFAF8',
    boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif',
  }
  const label = { display: 'block', fontSize: 10, fontWeight: 800, color: '#6B7280',
                  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }

  return (
    <div onClick={onClose}
         style={{ position: 'fixed', inset: 0, background: 'rgba(13,15,20,0.55)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 1000, backdropFilter: 'blur(2px)' }}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, padding: 28,
                     width: 480, maxWidth: '92vw',
                     boxShadow: '0 32px 72px rgba(0,0,0,0.22)' }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: '#0D0F14', marginBottom: 20,
                      fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.02em' }}>
          Nuevo Usuario
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Nombre completo</label>
          <input style={inputStyle} value={fullName}
                 onChange={e => setFullName(e.target.value)}
                 placeholder="Ej: María González" autoFocus />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Username</label>
          <input style={inputStyle} value={username}
                 onChange={e => setUsername(e.target.value)}
                 placeholder="ej. mgonzalez" />
          <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
            Solo letras, números, punto, guión y guión bajo. Mínimo 3 caracteres.
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={label}>Rol</label>
          <select value={role} onChange={e => setRole(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
            {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>

        <div style={{ background: 'rgba(217,119,6,0.08)',
                      border: '1px solid rgba(217,119,6,0.2)',
                      borderRadius: 8, padding: '8px 12px', marginTop: 10,
                      fontSize: 11, color: '#92400E', lineHeight: 1.5 }}>
          Se generará una <b>contraseña temporal</b> válida por 72 horas.
          El usuario deberá cambiarla en su primer ingreso.
        </div>

        {error && (
          <div style={{ background: 'rgba(228,0,43,0.07)',
                        border: '1px solid rgba(228,0,43,0.2)',
                        borderRadius: 8, padding: '8px 12px', marginTop: 10,
                        fontSize: 12, color: '#E4002B', fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8,
                      marginTop: 22, paddingTop: 16,
                      borderTop: '1px solid rgba(0,0,0,0.07)' }}>
          <button type="button" onClick={onClose} disabled={saving}
                  style={{ background: 'none', border: '1px solid rgba(0,0,0,0.13)',
                           borderRadius: 7, padding: '8px 16px', fontSize: 13,
                           cursor: 'pointer', color: '#374151' }}>
            Cancelar
          </button>
          <button type="submit" disabled={!username.trim() || !fullName.trim() || saving}
                  style={{
                    background: (username.trim() && fullName.trim() && !saving) ? '#E4002B' : '#E5E7EB',
                    border: 'none', borderRadius: 7, padding: '8px 22px',
                    fontSize: 13, fontWeight: 800,
                    cursor: (username.trim() && fullName.trim() && !saving) ? 'pointer' : 'default',
                    color: (username.trim() && fullName.trim() && !saving) ? '#fff' : '#9CA3AF',
                  }}>
            {saving ? 'Creando…' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </div>
  )
}

function TempPasswordModal({ data, onClose }) {
  const { user, password } = data
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* no-op */ }
  }

  return (
    <div onClick={onClose}
         style={{ position: 'fixed', inset: 0, background: 'rgba(13,15,20,0.65)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 1100, backdropFilter: 'blur(3px)' }}>
      <div onClick={e => e.stopPropagation()}
           style={{ background: '#fff', borderRadius: 16, padding: 30,
                    width: 480, maxWidth: '92vw',
                    boxShadow: '0 32px 72px rgba(0,0,0,0.25)' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%',
                        background: 'rgba(5,150,105,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" fill="none" stroke="#059669" strokeWidth="2.2" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#0D0F14',
                        fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.02em' }}>
            Contraseña temporal
          </div>
        </div>

        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
          Usuario: <b style={{ color: '#111827' }}>{user.full_name}</b>
          <span style={{ color: '#9CA3AF' }}> ({user.username})</span>
        </div>

        <div style={{ background: '#F3F4F6', border: '1px solid rgba(0,0,0,0.08)',
                      borderRadius: 10, padding: 16, marginBottom: 14,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <code style={{ fontSize: 16, fontWeight: 700, color: '#0D0F14',
                         fontFamily: 'monospace', letterSpacing: '0.5px',
                         userSelect: 'all' }}>
            {password}
          </code>
          <button onClick={copy}
                  style={{ background: copied ? '#059669' : '#0D0F14',
                           color: '#fff', border: 'none', borderRadius: 7,
                           padding: '7px 14px', fontSize: 12, fontWeight: 700,
                           cursor: 'pointer', flexShrink: 0 }}>
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>

        <div style={{ background: 'rgba(228,0,43,0.06)',
                      border: '1px solid rgba(228,0,43,0.2)',
                      borderRadius: 8, padding: '10px 14px', marginBottom: 18,
                      fontSize: 12, color: '#991B1B', lineHeight: 1.55 }}>
          <b>Importante:</b> esta es la <b>única vez</b> que vas a ver esta contraseña.
          Compartila con {user.full_name.split(' ')[0]} por un canal seguro.
          Expira en 72 horas y deberá cambiarla en su primer ingreso.
        </div>

        <button onClick={onClose}
                style={{ width: '100%', height: 40, borderRadius: 9, border: 'none',
                         background: '#0D0F14', color: '#fff',
                         fontSize: 13, fontWeight: 800, cursor: 'pointer',
                         fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.01em' }}>
          Listo
        </button>
      </div>
    </div>
  )
}
