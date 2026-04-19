import { useEffect, useState } from 'react'
import { ApiError, auth, docs as docsApi } from './api.js'
import { AdminUsers } from './components/AdminUsers.jsx'
import { AuditLog } from './components/AuditLog.jsx'
import { ChangePasswordScreen } from './components/ChangePasswordScreen.jsx'
import { Dashboard } from './components/Dashboard.jsx'
import { DeletedDocs } from './components/DeletedDocs.jsx'
import { DocDetail } from './components/DocEditor.jsx'
import { DocList } from './components/DocList.jsx'
import { LoginScreen } from './components/LoginScreen.jsx'
import { NewDocModal } from './components/NewDocModal.jsx'
import { Sidebar } from './components/Sidebar.jsx'

// Roles que pueden crear docs (cosmetic — el BFF enforcea).
const CAN_CREATE = new Set(['arq_datos', 'admin'])

export default function App() {
  const [bootstrapping, setBootstrapping] = useState(true)
  const [currentUser,   setCurrentUser]   = useState(null)
  const [docs,          setDocs]          = useState([])
  const [view,          setView]          = useState('dashboard')
  const [currentType,   setCurrentType]   = useState('hld')
  const [currentDocId,  setCurrentDocId]  = useState(null)
  const [showModal,     setShowModal]     = useState(false)
  const [modalType,     setModalType]     = useState(null)
  const [loadError,     setLoadError]     = useState('')

  // Bootstrap: ¿hay sesión? Si sí, cargar docs.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = await auth.me()
        if (cancelled) return
        setCurrentUser(me)
        if (!me.must_change_password) {
          await loadDocs()
        }
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 401)) {
          setLoadError(err.message || 'Error de conexión')
        }
      } finally {
        if (!cancelled) setBootstrapping(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const loadDocs = async () => {
    try {
      const list = await docsApi.list()
      setDocs(list)
    } catch (err) {
      // Si un request devuelve 423, es que must_change_password cambió — forzamos refresh
      if (err instanceof ApiError && err.status === 423) {
        try {
          const me = await auth.me()
          setCurrentUser(me)
        } catch { /* no-op */ }
      } else {
        throw err
      }
    }
  }

  const handleLogin = async (user) => {
    setCurrentUser(user)
    if (!user.must_change_password) {
      await loadDocs()
    }
  }

  const handlePasswordChanged = async (user) => {
    setCurrentUser(user)
    await loadDocs()
  }

  const handleLogout = async () => {
    try { await auth.logout() } catch { /* no-op */ }
    setCurrentUser(null)
    setDocs([])
    setView('dashboard')
    setCurrentDocId(null)
  }

  const navigate = (newView, typeId, docId) => {
    setView(newView)
    if (typeId) setCurrentType(typeId)
    if (docId !== undefined) setCurrentDocId(docId)
  }

  const openNew = (typeId) => {
    if (!currentUser || !CAN_CREATE.has(currentUser.role)) return
    setModalType(typeId || null)
    setShowModal(true)
  }

  const saveNew = async (payload) => {
    const created = await docsApi.create(payload)
    setDocs(prev => [created, ...prev])
    setShowModal(false)
    navigate('detail', created.type, created.id)
  }

  const handleDocUpdated = (updated) => {
    setDocs(prev => {
      // Si fue restaurado, puede no estar en la lista actual (estábamos en papelera)
      if (!prev.find(d => d.id === updated.id)) {
        return updated.deleted_at ? prev : [updated, ...prev]
      }
      return prev.map(d => d.id === updated.id ? updated : d)
    })
  }

  const handleDocDeleted = (deletedId) => {
    // Saco el doc del listado activo y vuelvo a la lista
    setDocs(prev => prev.filter(d => d.id !== deletedId))
    const deletedDoc = docs.find(d => d.id === deletedId)
    navigate('list', deletedDoc?.type || currentType)
    setCurrentDocId(null)
  }

  // ─── Render ────────────────────────────────────────────────────────────

  if (bootstrapping) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', background: '#F5F4F1',
                    flexDirection: 'column', gap: 12 }}>
        <svg style={{ animation: 'spin 0.8s linear infinite', color: '#E4002B' }}
             width="22" height="22" fill="none" stroke="currentColor"
             strokeWidth="2.5" viewBox="0 0 24 24">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        {loadError && <div style={{ fontSize: 12, color: '#E4002B', fontWeight: 600 }}>{loadError}</div>}
      </div>
    )
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />
  }

  // Bloqueo obligatorio: debe cambiar password antes de ver nada más
  if (currentUser.must_change_password) {
    return <ChangePasswordScreen user={currentUser} onChanged={handlePasswordChanged} />
  }

  const currentDoc = docs.find(d => d.id === currentDocId)
  const canCreate  = CAN_CREATE.has(currentUser.role)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden',
                  fontFamily: 'DM Sans, Outfit, sans-serif' }}>
      <Sidebar
        currentView={view}
        currentType={currentType}
        onNavigate={navigate}
        docs={docs}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {view === 'dashboard' && (
          <Dashboard docs={docs} onNavigate={navigate}
                     onNew={() => openNew(null)} canCreate={canCreate} />
        )}
        {view === 'list' && (
          <DocList docs={docs} typeId={currentType}
                   onNavigate={navigate} onNew={openNew} canCreate={canCreate} />
        )}
        {view === 'detail' && (
          <DocDetailLoader
            docId={currentDocId}
            cached={currentDoc}
            currentUser={currentUser}
            onBack={() => navigate(currentDoc?.deleted_at ? 'admin-deleted' : 'list', currentDoc?.type || currentType)}
            onUpdated={handleDocUpdated}
            onDeleted={handleDocDeleted}
          />
        )}
        {view === 'admin-users' && currentUser.role === 'admin' && (
          <AdminUsers currentUser={currentUser} />
        )}
        {view === 'admin-deleted' && currentUser.role === 'admin' && (
          <DeletedDocs onNavigate={navigate} onRestored={handleDocUpdated} />
        )}
        {view === 'admin-audit' && currentUser.role === 'admin' && (
          <AuditLog />
        )}
      </main>

      {showModal && (
        <NewDocModal
          onClose={() => setShowModal(false)}
          onSave={saveNew}
          defaultType={modalType}
        />
      )}
    </div>
  )
}

/**
 * Carga un doc on-demand si no está en el cache (p.ej. al navegar desde
 * la papelera a un doc soft-deleted que no está en `docs`).
 */
function DocDetailLoader({ docId, cached, currentUser, onBack, onUpdated, onDeleted }) {
  const [doc,   setDoc]   = useState(cached || null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!docId) { setDoc(null); return }
    if (cached && cached.id === docId) { setDoc(cached); return }
    // Fetch individual
    let cancelled = false
    ;(async () => {
      try {
        const fresh = await docsApi.get(docId)
        if (!cancelled) setDoc(fresh)
      } catch (err) {
        if (!cancelled) setError(err.message || 'No se pudo cargar el documento')
      }
    })()
    return () => { cancelled = true }
  }, [docId, cached])

  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: '#9CA3AF', fontSize: 14,
                    flexDirection: 'column', gap: 10 }}>
        <div style={{ color: '#E4002B', fontWeight: 600 }}>{error}</div>
        <button onClick={onBack}
                style={{ color: '#E4002B', background: 'none', border: 'none',
                         cursor: 'pointer', fontWeight: 700 }}>Volver</button>
      </div>
    )
  }

  if (!doc) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg style={{ animation: 'spin 0.8s linear infinite', color: '#9CA3AF' }}
             width="20" height="20" fill="none" stroke="currentColor"
             strokeWidth="2.5" viewBox="0 0 24 24">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      </div>
    )
  }

  return (
    <DocDetail
      doc={doc}
      currentUser={currentUser}
      onBack={onBack}
      onUpdated={(u) => { setDoc(u); onUpdated(u) }}
      onDeleted={onDeleted}
    />
  )
}
