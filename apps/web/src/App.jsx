import { useEffect, useState } from 'react'
import { ApiError, auth, docs as docsApi } from './api.js'
import { Dashboard } from './components/Dashboard.jsx'
import { DocDetail } from './components/DocEditor.jsx'
import { DocList } from './components/DocList.jsx'
import { LoginScreen } from './components/LoginScreen.jsx'
import { NewDocModal } from './components/NewDocModal.jsx'
import { Sidebar } from './components/Sidebar.jsx'

// Permisos relevantes para mostrar/ocultar botones en UI.
// La autorización REAL la hace el BFF — esto es solo cosmético.
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

  // Bootstrap: ¿hay sesión activa? Si sí, cargar docs.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = await auth.me()
        if (cancelled) return
        setCurrentUser(me)
        await loadDocs()
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
    const list = await docsApi.list()
    setDocs(list)
  }

  const handleLogin = async (user) => {
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
    if (docId)  setCurrentDocId(docId)
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
    setDocs(prev => prev.map(d => d.id === updated.id ? updated : d))
  }

  if (bootstrapping) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F4F1', flexDirection: 'column', gap: 12 }}>
        <svg style={{ animation: 'spin 0.8s linear infinite', color: '#E4002B' }} width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        {loadError && <div style={{ fontSize: 12, color: '#E4002B', fontWeight: 600 }}>{loadError}</div>}
      </div>
    )
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />
  }

  const currentDoc = docs.find(d => d.id === currentDocId)
  const canCreate  = CAN_CREATE.has(currentUser.role)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'DM Sans, Outfit, sans-serif' }}>
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
          <Dashboard docs={docs} onNavigate={navigate} onNew={() => openNew(null)} canCreate={canCreate} />
        )}
        {view === 'list' && (
          <DocList docs={docs} typeId={currentType} onNavigate={navigate} onNew={openNew} canCreate={canCreate} />
        )}
        {view === 'detail' && currentDoc && (
          <DocDetail
            doc={currentDoc}
            currentUser={currentUser}
            onBack={() => navigate('list', currentDoc.type)}
            onUpdated={handleDocUpdated}
          />
        )}
        {view === 'detail' && !currentDoc && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 14 }}>
            Documento no encontrado.
            <button onClick={() => navigate('dashboard')} style={{ marginLeft: 8, color: '#E4002B', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Volver al inicio</button>
          </div>
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
