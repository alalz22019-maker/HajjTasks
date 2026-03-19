import { useState } from 'react'

const PRIORITY_LABELS = { urgent: 'عاجل', medium: 'متوسطة', low: 'منخفضة' }
const CATEGORY_LABELS = { work: 'عمل', personal: 'شخصي', health: 'صحة' }
const SUBCATEGORY_LABELS = {
  leaders: 'القادة', team: 'الفريق', other: 'أخرى',
  home: 'البيت', business: 'بيزنس'
}
const RECURRENCE_LABELS = { daily: 'يومي', weekly: 'أسبوعي', monthly: 'شهري' }

function formatDate(d) {
  if (!d) return null
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export default function TaskCard({ task, onToggle, onEdit, onDelete, showToast }) {
  const [expanded, setExpanded] = useState(false)

  function shareWhatsApp() {
    const msg = encodeURIComponent(
      `📋 *${task.title}*\n` +
      (task.person ? `👤 ${task.person}\n` : '') +
      (task.dueDate ? `📅 ${formatDate(task.dueDate)}\n` : '') +
      `🔖 ${PRIORITY_LABELS[task.priority] || ''} | ${CATEGORY_LABELS[task.category] || ''}`
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  function openCalendar() {
    const title = encodeURIComponent(task.title)
    const details = encodeURIComponent(
      (task.person ? `المسؤول: ${task.person}\n` : '') +
      (task.subcategory ? `التصنيف: ${SUBCATEGORY_LABELS[task.subcategory] || task.subcategory}` : '')
    )
    let dates = ''
    if (task.dueDate) {
      const d = task.dueDate.replace(/-/g, '')
      dates = `&dates=${d}/${d}`
    }
    const recur = task.recurrence === 'daily' ? '&recur=RRULE:FREQ=DAILY'
      : task.recurrence === 'weekly' ? '&recur=RRULE:FREQ=WEEKLY'
      : task.recurrence === 'monthly' ? '&recur=RRULE:FREQ=MONTHLY'
      : ''
    window.open(
      `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}${dates}${recur}`,
      '_blank'
    )
  }

  return (
    <div className={`task-card${task.done ? ' done' : ''}`}>
      <div className="task-top">
        <button
          className={`task-check${task.done ? ' done' : ''}`}
          onClick={() => onToggle(task.id)}
          aria-label="إتمام المهمة"
        >
          {task.done && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
        </button>

        <div className="task-body" onClick={() => setExpanded(e => !e)} style={{ cursor: 'pointer' }}>
          <div className={`task-title${task.done ? ' done' : ''}`}>{task.title}</div>
          <div className="task-meta">
            <span className={`badge badge-${task.priority}`}>
              {PRIORITY_LABELS[task.priority]}
            </span>
            <span className={`badge badge-${task.category}`}>
              {CATEGORY_LABELS[task.category]}
            </span>
            {task.subcategory && task.subcategory !== 'other' && (
              <span className="badge badge-date">
                {SUBCATEGORY_LABELS[task.subcategory] || task.subcategory}
              </span>
            )}
            {task.dueDate && (
              <span className="badge badge-date">📅 {formatDate(task.dueDate)}</span>
            )}
            {task.person && (
              <span className="badge badge-person">👤 {task.person}</span>
            )}
            {task.recurrence && (
              <span className="badge badge-recur">🔄 {RECURRENCE_LABELS[task.recurrence]}</span>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="task-actions">
          <button className="task-action-btn whatsapp" onClick={shareWhatsApp}>
            <span>💬</span> واتساب
          </button>
          <button className="task-action-btn calendar" onClick={openCalendar}>
            <span>📅</span> تقويم
          </button>
          <button className="task-action-btn edit" onClick={() => onEdit(task)}>
            <span>✏️</span> تعديل
          </button>
          <button className="task-action-btn delete" onClick={() => onDelete(task.id)}>
            <span>🗑</span> حذف
          </button>
        </div>
      )}
    </div>
  )
}
