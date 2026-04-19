// constants.js — metadata UI (artifact types, status, templates).
// Las definiciones de artefactos viven en el cliente porque son metadata de
// presentación (labels, colores, secciones del template). Los DOCUMENTOS
// concretos vienen del BFF.

export const ARTIFACT_TYPES = [
  { id: 'hld',        label: 'HLD / SAD',           shortLabel: 'HLD',  color: '#2563EB' },
  { id: 'adr',        label: 'ADR',                  shortLabel: 'ADR',  color: '#E4002B' },
  { id: 'rfc',        label: 'RFC',                  shortLabel: 'RFC',  color: '#7C3AED' },
  { id: 'capability', label: 'Capability Request',   shortLabel: 'CAP',  color: '#059669' },
]

export const STATUS_CONFIG = {
  'Draft':      { color: '#6B7280', bg: 'rgba(107,114,128,0.12)', label: 'Borrador'    },
  'In Review':  { color: '#D97706', bg: 'rgba(217,119,6,0.12)',   label: 'En Revisión' },
  'Approved':   { color: '#059669', bg: 'rgba(5,150,105,0.12)',   label: 'Aprobado'    },
  'Deprecated': { color: '#DC2626', bg: 'rgba(220,38,38,0.10)',   label: 'Deprecado'   },
}

export const ARTIFACT_TEMPLATES = {
  hld: { sections: [
    { id: 'context',      label: 'Contexto de Negocio',                         placeholder: 'Describí el problema de negocio y el contexto regulatorio que esta solución resuelve...' },
    { id: 'capabilities', label: 'Capacidades Requeridas',                       placeholder: 'Listá las capacidades técnicas y funcionales necesarias...' },
    { id: 'nfrs',         label: 'NFRs — SLAs, Throughput, RPO/RTO, Seguridad, Compliance Bancario', placeholder: 'SLA: 99.9%\nThroughput: X eventos/seg\nRPO: 4h / RTO: 2h\nSeguridad: cifrado en tránsito y reposo\n...' },
    { id: 'components',   label: 'Diagrama de Componentes',                      placeholder: 'Descripción de la arquitectura de componentes, capas y servicios...' },
    { id: 'integrations', label: 'Integraciones',                                placeholder: 'Sistemas upstream/downstream, APIs, eventos, contratos de datos...' },
    { id: 'assumptions',  label: 'Supuestos',                                    placeholder: 'Listá los supuestos sobre los que se basa este diseño...' },
    { id: 'raci_ref',     label: 'Responsabilidades por Capa (ref. RACI)',       placeholder: 'Bronze: Arquitectura de Datos\nSilver: Arquitectura de Datos + Plataforma\nGold: Data Engineers\n...' },
  ]},
  adr: { sections: [
    { id: 'context',      label: 'Contexto',             placeholder: 'El contexto técnico y de negocio que motivó esta decisión...' },
    { id: 'options',      label: 'Opciones Consideradas', placeholder: 'Opción A: ...\nOpción B: ...\nOpción C: ...' },
    { id: 'decision',     label: 'Decisión',              placeholder: 'Decidimos usar X porque...' },
    { id: 'consequences', label: 'Consecuencias',         placeholder: 'Trade-offs, deuda técnica, dependencias generadas, revisión en...' },
  ]},
  rfc: { sections: [
    { id: 'problem',        label: 'Problema',          placeholder: 'El problema que este RFC busca resolver...' },
    { id: 'proposal',       label: 'Propuesta',         placeholder: 'La solución propuesta...' },
    { id: 'alternatives',   label: 'Alternativas',      placeholder: 'Otras alternativas consideradas...' },
    { id: 'open_questions', label: 'Preguntas Abiertas', placeholder: '1. ¿Cuál es el approach preferido para X?\n2. ¿Cómo manejamos Y?' },
    { id: 'stakeholders',   label: 'Stakeholders',      placeholder: 'Listá los equipos y personas que deben revisar y comentar este RFC...' },
  ]},
  capability: { sections: [
    { id: 'service',       label: 'Servicio / Infraestructura Requerida', placeholder: 'Qué necesitás de plataforma: cluster, IAM, networking, storage...' },
    { id: 'justification', label: 'Justificación',                         placeholder: 'Por qué es necesario y qué problema resuelve...' },
    { id: 'hld_ref',       label: 'Referencia HLD',                        placeholder: 'ID o link al HLD asociado que detalla el contexto completo...' },
    { id: 'slas',          label: 'SLAs Esperados',                        placeholder: 'Disponibilidad, latencia, capacidad, ventana de mantenimiento...' },
    { id: 'timeline',      label: 'Timeline',                              placeholder: 'Fecha de necesidad, hitos de entrega, dependencias...' },
  ]},
  raci: { sections: [
    { id: 'scope',  label: 'Alcance del RACI',              placeholder: 'Describe el dominio e iniciativa que cubre este RACI...' },
    { id: 'layers', label: 'Capas y Responsabilidades',     placeholder: 'Bronze Layer:\n  R = Data Engineering\n  A = Arquitectura de Datos\n  C = Plataforma\n  I = Tech Lead\n\nSilver Layer:\n  R = ...' },
    { id: 'notes',  label: 'Notas, Bordes y Excepciones',   placeholder: 'Casos borde, escaladas, frecuencia de revisión...' },
  ]},
}

export const ROLE_LABELS = {
  arq_datos:  'Arquitecto de Datos',
  arq_lead:   'Arquitecto Líder',
  tech_lead:  'Tech Lead',
  admin:      'Admin',
  dm:         'Delivery Manager',
}

export const ALL_ROLES = ['arq_datos', 'arq_lead', 'tech_lead', 'admin', 'dm']
