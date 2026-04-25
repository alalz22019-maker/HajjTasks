import { useState } from 'react'
import { TEAM_MEMBERS, getEffectiveStatus, getStatusInfo, STATUS_OPTIONS } from '../constants'

export default function SubtaskInline({ task, onUpdate, onToggle, onDelete, onAssign, canWrite }) {
  const [editing, setEditing] = useState(null) // 'title' | 'date' | 'person' | null
  const [editValue, setEditValue] = useState('')
  const effectiveStatus = getEffectiveStatus(task)
  const statusInfo = getStatusInfo(effectiveStatus)

  function startEdit(field) {
    setEditing(field)
    setEditValue(task[field] || '')
  }

  function saveEdit() {
    if (!editing) return
    const updates = { [editing]: editValue }
    if (editing === 'title' && !editValue.trim()) { setEditing(null); return }
    onUpdate(task.id, updates)
    setEditing(null)
  }

  const inputStyle = {
    width: '100%', padding: '6px 8px', borderRadius: 6,
    border: '1px solid var(--border)', background: 'var(--bg)',
    color: 'var(--text)', fontSize: 12, fontFamily: 'inherit',
    boxSizing: 'border-box',
  }

  return (
    <div style={{
      padding: '10px 12px', borderRadius: 12, marginBottom: 4,
      background: task.done ? 'rgba(16,185,129,0.04)' : 'var(--card)',
      border: `1px solid ${statusInfo.color}22`,
      borderRight: `3px solid ${statusInfo.color}`,
    }}>
      {/* العنوان */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => onToggle(task.id)} style={{
          width: 20, height: 20, borderRadius: 6, border: `2px solid ${task.done ? '#10b981' : 'var(--border)'}`,
          background: task.done ? '#10b981' : 'transparent', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0,
        }}>
          {task.done && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
        </button>

        {editing === 'title' ? (
          <div style={{ flex: 1, display: 'flex', gap: 4 }}>
            <input value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit()}
              style={inputStyle} autoFocus />
            <button onClick={saveEdit} style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--blue)', color: '#fff', border: 'none', fontSize: 11, cursor: 'pointer' }}>✓</button>
          </div>
        ) : (
          <div onClick={() => canWrite && startEdit('title')} style={{
            flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text)',
            textDecoration: task.done ? 'line-through' : 'none',
            opacity: task.done ? 0.6 : 1, cursor: canWrite ? 'pointer' : 'default',
          }}>
            {task.title}
          </div>
        )}

        {/* حالة */}
        <span style={{
          fontSize: 9, padding: '2px 6px', borderRadius: 6,
          background: `${statusInfo.color}20`, color: statusInfo.color, fontWeight: 700,
        }}>{statusInfo.label}</span>
      </div>

      {/* التفاصيل — تاريخ + مسؤول */}
      <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* التاريخ */}
        {editing === 'dueDate' ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <input type="date" value={editValue} onChange={e => setEditValue(e.target.value)}
              style={{ ...inputStyle, width: 'auto' }} />
            <button onClick={saveEdit} style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--blue)', color: '#fff', border: 'none', fontSize: 11, cursor: 'pointer' }}>✓</button>
          </div>
        ) : (
          <span onClick={() => canWrite && startEdit('dueDate')} style={{
            fontSize: 11, color: 'var(--text3)', cursor: canWrite ? 'pointer' : 'default',
            padding: '2px 6px', borderRadius: 6, background: 'var(--bg3)',
          }}>
            📅 {task.dueDate ? new Date(task.dueDate).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' }) : 'بدون تاريخ'}
          </span>
        )}

        {/* المسؤول */}
        {editing === 'person' ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <select value={editValue} onChange={e => setEditValue(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
              <option value="">— اختر —</option>
              {TEAM_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button onClick={saveEdit} style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--blue)', color: '#fff', border: 'none', fontSize: 11, cursor: 'pointer' }}>✓</button>
          </div>
        ) : (
          <span onClick={() => canWrite ? startEdit('person') : (onAssign && onAssign(task))} style={{
            fontSize: 11, color: 'var(--text3)', cursor: 'pointer',
            padding: '2px 6px', borderRadius: 6, background: 'var(--bg3)',
          }}>
            👤 {task.person || 'بدون مسؤول'}
          </span>
        )}

        {/* زر إسناد (للموظف) */}
        {!canWrite && onAssign && !task.done && (
          <button onClick={() => onAssign(task)} style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 6,
            background: 'rgba(139,92,246,0.1)', color: '#8b5cf6',
            border: '1px solid rgba(139,92,246,0.2)', cursor: 'pointer', fontFamily: 'inherit',
          }}>📌 إسناد</button>
        )}

        {/* حذف */}
        {canWrite && onDelete && (
          <button onClick={() => onDelete(task.id)} style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 6,
            background: 'rgba(239,68,68,0.08)', color: '#ef4444',
            border: 'none', cursor: 'pointer', marginRight: 'auto',
          }}>🗑</button>
        )}
      </div>
    </div>
  )
}
