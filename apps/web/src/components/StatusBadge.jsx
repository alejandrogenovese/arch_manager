import { STATUS_CONFIG } from '../constants.js'

export function StatusBadge({ status, size }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['Draft']
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: cfg.bg, color: cfg.color,
      fontSize: size === 'md' ? 12 : 11,
      fontWeight: 700, padding: '3px 9px', borderRadius: 20,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color }} />
      {cfg.label}
    </span>
  )
}
