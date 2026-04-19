import { useEffect, useRef, useState } from 'react'
import { ARTIFACT_TEMPLATES, ARTIFACT_TYPES, STATUS_CONFIG } from '../constants.js'
import { attachments as attApi, docs as docsApi } from '../api.js'
import { StatusBadge } from './StatusBadge.jsx'

// Las transiciones que el cliente ofrece visualmente. La autorización real
// la hace el BFF — acá solo pintamos botones razonables; si el usuario no
// puede, el BFF responde 403 y mostramos el error.
const NEXT_STATUS = {
  'Draft':      ['In Review'],
  'In Review':  ['Approved', 'Draft'],
  'Approved':   ['Deprecated'],
  'Deprecated': [],
}

export function DocDetail({ doc, onBack, onUpdated, currentUser }) {
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm]           = useState(() => normalize(doc))
  const [saved, setSaved]         = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => { setForm(normalize(doc)) }, [doc])

  const type     = ARTIFACT_TYPES.find(t => t.id === doc.type)
  const template = ARTIFACT_TEMPLATES[doc.type]
  const sections = template?.sections || []

  const canEdit = currentUser?.role === 'admin'
                 || (currentUser?.role === 'arq_datos' && currentUser?.name === doc.author)

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const updated = await docsApi.update(doc.id, {
        title:    form.title,
        domain:   form.domain,
        sections: form.sections,
      })
      onUpdated(updated)
      setIsEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.message || 'No se pudo guardar')
    }
    setSaving(false)
  }

  const handleStatusChange = async (newStatus) => {
    setError('')
    try {
      const updated = await docsApi.transition(doc.id, newStatus)
      onUpdated(updated)
    } catch (err) {
      setError(err.message || 'Transición no permitida')
    }
  }

  const handleExportMarkdown = () => {
    let md = `# ${form.title}\n\n`
    md += `| Campo | Valor |\n|---|---|\n`
    md += `| Tipo | ${type?.label} |\n`
    md += `| Estado | ${form.status} |\n`
    md += `| Autor | ${form.author} |\n`
    md += `| Dominio | ${form.domain} |\n`
    md += `| ID | ${form.id} |\n`
    md += `| Creado | ${form.createdAt} |\n`
    md += `| Actualizado | ${form.updatedAt} |\n\n---\n\n`
    sections.forEach(s => {
      md += `## ${s.label}\n\n${form.sections?.[s.id] || '_Sin contenido_'}\n\n`
    })
    const blob = new Blob([md], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${form.id}.md`
    a.click()
  }

  const setSection = (id, value) => {
    setForm(f => ({ ...f, sections: { ...(f.sections || {}), [id]: value } }))
  }

  const inputBase = {
    border: '1px solid rgba(0,0,0,0.13)', borderRadius: 7,
    padding: '7px 10px', fontSize: 12, background: '#FAFAF8',
    outline: 'none', width: '100%', boxSizing: 'border-box',
    fontFamily: 'DM Sans, sans-serif', color: '#111827',
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F5F4F1', overflow: 'hidden' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 28px', background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#6B7280', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6 }}
        >
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M19 12H5m0 0 7 7m-7-7 7-7"/></svg>
          Volver
        </button>
        <span style={{ color: '#D1D5DB', fontSize: 16 }}>›</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: type?.color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{type?.label}</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          {saved && <span style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>✓ Guardado</span>}
          {error && <span style={{ fontSize: 11, color: '#E4002B', fontWeight: 700 }}>{error}</span>}
          <button
            onClick={handleExportMarkdown}
            style={{ background: 'none', border: '1px solid rgba(0,0,0,0.13)', borderRadius: 7, padding: '6px 12px', fontSize: 11, cursor: 'pointer', color: '#6B7280', fontWeight: 600 }}
          >↓ Markdown</button>
          {!isEditing ? (
            canEdit && (
              <button
                onClick={() => setIsEditing(true)}
                style={{ background: 'none', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#374151' }}
              >Editar</button>
            )
          ) : (
            <>
              <button
                onClick={() => { setForm(normalize(doc)); setIsEditing(false); setError('') }}
                disabled={saving}
                style={{ background: 'none', border: '1px solid rgba(0,0,0,0.13)', borderRadius: 7, padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: '#6B7280' }}
              >Cancelar</button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ background: '#E4002B', border: 'none', borderRadius: 7, padding: '6px 18px', fontSize: 12, fontWeight: 800, cursor: 'pointer', color: '#fff' }}
              >{saving ? 'Guardando…' : 'Guardar'}</button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px' }}>

          <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
            {isEditing ? (
              <input
                style={{ ...inputBase, fontSize: 20, fontWeight: 900, letterSpacing: '-0.03em', fontFamily: 'Outfit, sans-serif', background: 'transparent', border: 'none', borderBottom: '2px solid #E4002B', borderRadius: 0, padding: '4px 0', width: '100%' }}
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            ) : (
              <h1 style={{ fontSize: 20, fontWeight: 900, color: '#0D0F14', margin: 0, letterSpacing: '-0.03em', fontFamily: 'Outfit, sans-serif', lineHeight: 1.3 }}>
                {form.title}
              </h1>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {sections.map(section => (
              <div key={section.id}>
                <div style={{ fontSize: 10, fontWeight: 900, color: '#374151', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }}>
                  {section.label}
                </div>
                {isEditing ? (
                  <textarea
                    style={{ ...inputBase, resize: 'vertical', lineHeight: 1.65, minHeight: 90 }}
                    placeholder={section.placeholder}
                    value={form.sections?.[section.id] || ''}
                    onChange={e => setSection(section.id, e.target.value)}
                    rows={4}
                  />
                ) : (
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.75, background: '#fff', borderRadius: 8, padding: '10px 14px', border: '1px solid rgba(0,0,0,0.06)', whiteSpace: 'pre-wrap', minHeight: 42 }}>
                    {form.sections?.[section.id] || <span style={{ color: '#C4C4C4', fontStyle: 'italic' }}>Sin contenido</span>}
                  </div>
                )}
              </div>
            ))}
          </div>

          <AttachmentsSection
            docId={doc.id}
            attachments={form.attachments}
            canEdit={canEdit && isEditing}
            onChanged={(list) => setForm(f => ({ ...f, attachments: list }))}
          />
        </div>

        <div style={{ width: 228, overflowY: 'auto', padding: '20px 16px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.07)', padding: '14px' }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: '#9CA3AF', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 9 }}>Estado</div>
            <StatusBadge status={form.status} size="md" />

            {NEXT_STATUS[form.status]?.length > 0 && (
              <div style={{ marginTop: 11 }}>
                <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 5 }}>Mover a:</div>
                {NEXT_STATUS[form.status].map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, width: '100%', marginBottom: 4,
                      background: STATUS_CONFIG[s]?.bg, border: 'none', borderRadius: 6,
                      padding: '6px 10px', fontSize: 11, cursor: 'pointer',
                      color: STATUS_CONFIG[s]?.color, fontWeight: 700,
                    }}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_CONFIG[s]?.color }} />
                    {STATUS_CONFIG[s]?.label}
                  </button>
                ))}
              </div>
            )}

            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.07)' }}>
              {['Draft', 'In Review', 'Approved'].map((s, i) => {
                const order = ['Draft', 'In Review', 'Approved', 'Deprecated']
                const curIdx  = order.indexOf(form.status)
                const stepIdx = order.indexOf(s)
                const done    = curIdx > stepIdx || form.status === s
                const active  = form.status === s
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: i < 2 ? 8 : 0 }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                      background: done ? STATUS_CONFIG[s]?.color : 'rgba(0,0,0,0.07)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, color: done ? '#fff' : '#9CA3AF', fontWeight: 800,
                    }}>{done && curIdx > stepIdx ? '✓' : i + 1}</div>
                    <span style={{ fontSize: 11, color: active ? '#111827' : '#9CA3AF', fontWeight: active ? 700 : 400 }}>
                      {STATUS_CONFIG[s]?.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.07)', padding: '14px' }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: '#9CA3AF', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Metadata</div>
            {[
              { label: 'Autor',       field: 'author',  editable: false },
              { label: 'Dominio',     field: 'domain',  editable: true  },
              { label: 'Creado',      field: 'createdAt', editable: false },
              { label: 'Actualizado', field: 'updatedAt', editable: false },
            ].map(({ label, field, editable }) => (
              <div key={field} style={{ marginBottom: 9 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                {isEditing && editable ? (
                  <input
                    style={{ ...inputBase, padding: '4px 8px', fontSize: 11 }}
                    value={form[field] || ''}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  />
                ) : (
                  <div style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{form[field] || '—'}</div>
                )}
              </div>
            ))}
            <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>ID</div>
              <code style={{ fontSize: 10, color: '#6B7280', background: '#F3F4F6', padding: '2px 6px', borderRadius: 4 }}>{form.id}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function normalize(doc) {
  return { ...doc, sections: { ...(doc.sections || {}) }, attachments: doc.attachments || [] }
}

// ─── Attachments ─────────────────────────────────────────────────────────────

const ACCEPTED = '.drawio,.xml,image/png,image/jpeg,image/gif,image/webp,image/svg+xml,.svg,.png,.jpg,.jpeg,.gif,.webp'

function AttachmentsSection({ docId, attachments, canEdit, onChanged }) {
  const [viewing, setViewing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()

  const list = attachments || []

  const handleFiles = async (files) => {
    setError('')
    setBusy(true)
    let next = [...list]
    for (const file of Array.from(files)) {
      if (file.size > 8 * 1024 * 1024) {
        setError(`${file.name} supera 8 MB — reducí el archivo.`)
        continue
      }
      try {
        const att = await attApi.upload(docId, file)
        next = [...next, att]
      } catch (err) {
        setError(err.message || `No se pudo subir ${file.name}`)
      }
    }
    onChanged(next)
    setBusy(false)
  }

  const removeAtt = async (id) => {
    setError('')
    try {
      await attApi.remove(id)
      onChanged(list.filter(a => a.id !== id))
    } catch (err) {
      setError(err.message || 'No se pudo eliminar el adjunto')
    }
  }

  const isDrawio = (att) => att.name.endsWith('.drawio') || att.name.endsWith('.xml')
  const isImage  = (att) => att.mime?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(att.name)

  // Para abrir .drawio en diagrams.net necesitamos descargar el contenido
  // y armar la URL — lo hacemos on-demand para no traer todos los XMLs.
  const openInDiagrams = async (att) => {
    try {
      const res = await fetch(attApi.url(att.id), { credentials: 'include' })
      const xml = await res.text()
      const encoded = btoa(unescape(encodeURIComponent(xml)))
      window.open(`https://app.diagrams.net/#xml=${encoded}`, '_blank', 'noopener,noreferrer')
    } catch {
      window.open('https://app.diagrams.net/', '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(0,0,0,0.07)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: '#374151', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Adjuntos {list.length > 0 && <span style={{ color: '#9CA3AF', fontWeight: 600 }}>({list.length})</span>}
        </div>
        {canEdit && (
          <>
            <button
              onClick={() => fileRef.current.click()}
              disabled={busy}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'none', border: '1px dashed rgba(0,0,0,0.2)', borderRadius: 7,
                padding: '5px 12px', fontSize: 11, fontWeight: 700, color: '#6B7280', cursor: 'pointer',
              }}
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              {busy ? 'Subiendo…' : 'Subir archivo'}
            </button>
            <input ref={fileRef} type="file" multiple accept={ACCEPTED} style={{ display: 'none' }} onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
          </>
        )}
      </div>

      {error && (
        <div style={{ marginBottom: 10, fontSize: 11, color: '#E4002B', fontWeight: 600 }}>{error}</div>
      )}

      {canEdit && list.length === 0 && (
        <div
          style={{ border: '1.5px dashed rgba(0,0,0,0.15)', borderRadius: 10, padding: '28px 20px', textAlign: 'center', color: '#9CA3AF', fontSize: 12, background: 'rgba(0,0,0,0.02)', cursor: 'pointer' }}
          onClick={() => fileRef.current.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
        >
          <div style={{ fontSize: 20, marginBottom: 6, opacity: 0.35 }}>⊕</div>
          Arrastrá imágenes o archivos <code style={{ fontSize: 11, background: '#F3F4F6', padding: '1px 5px', borderRadius: 4 }}>.drawio</code> acá
        </div>
      )}

      {list.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}
          onDragOver={canEdit ? e => e.preventDefault() : undefined}
          onDrop={canEdit ? e => { e.preventDefault(); handleFiles(e.dataTransfer.files) } : undefined}
        >
          {list.map(att => (
            <div
              key={att.id}
              style={{ position: 'relative', borderRadius: 9, border: '1px solid rgba(0,0,0,0.09)', background: '#fff', overflow: 'hidden', cursor: 'pointer' }}
              onClick={() => setViewing(att)}
            >
              {isImage(att) ? (
                <img src={att.url} alt={att.name} style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ height: 90, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #EFF6FF 0%, #EDE9FE 100%)', gap: 6 }}>
                  <svg width="28" height="28" fill="none" stroke="#6366F1" strokeWidth="1.5" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/>
                  </svg>
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#6366F1', letterSpacing: '0.08em', textTransform: 'uppercase' }}>draw.io</span>
                </div>
              )}
              <div style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {att.name}
              </div>
              {canEdit && (
                <button
                  onClick={e => { e.stopPropagation(); removeAtt(att.id) }}
                  style={{
                    position: 'absolute', top: 5, right: 5,
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff',
                    fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', lineHeight: 1,
                  }}
                >×</button>
              )}
            </div>
          ))}
        </div>
      )}

      {viewing && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(13,15,20,0.82)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setViewing(null)}
        >
          <div style={{ position: 'absolute', top: 18, right: 22, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: 0.7 }} onClick={() => setViewing(null)}>✕ Cerrar</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 12, fontWeight: 600 }}>{viewing.name}</div>
          <div
            style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            onClick={e => e.stopPropagation()}
          >
            {isImage(viewing) ? (
              <img src={viewing.url} alt={viewing.name} style={{ maxWidth: '85vw', maxHeight: '75vh', objectFit: 'contain', display: 'block' }} />
            ) : (
              <div style={{ padding: '48px 56px', textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>
                  <svg width="56" height="56" fill="none" stroke="#6366F1" strokeWidth="1.2" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/>
                  </svg>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#111827', marginBottom: 6 }}>{viewing.name}</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 20 }}>Los archivos .drawio se abren en diagrams.net para una visualización completa.</div>
                <button
                  onClick={(e) => { e.stopPropagation(); openInDiagrams(viewing) }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    background: '#6366F1', color: '#fff', borderRadius: 8,
                    padding: '10px 20px', fontSize: 13, fontWeight: 700,
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  Abrir en diagrams.net
                </button>
              </div>
            )}
          </div>
          <a
            href={viewing.url}
            download={viewing.name}
            style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontWeight: 600 }}
            onClick={e => e.stopPropagation()}
          >↓ Descargar</a>
        </div>
      )}
    </div>
  )
}
