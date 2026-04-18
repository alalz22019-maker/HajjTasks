import { useState } from 'react'

const PRIORITY_LABELS = { urgent: 'عاجل', medium: 'متوسطة', low: 'منخفضة' }
const CATEGORY_LABELS = { 
  work: 'عمل', personal: 'شخصي', health: 'صحة',
  operations: '⚙️ تشغيلية', quality: '✅ جودة', coordination: '🤝 تنسيق',
  planning: '📋 تخطيط', reports: '📊 تقارير', training: '📚 تدريب',
  procurement: '📦 تموين', technical: '🔧 فني', admin: '🏢 إدارية',
}
const SUBCATEGORY_LABELS = {
  leaders: 'القادة', team: 'الفريق', other: 'أخرى',
  home: 'البيت', business: 'بيزنس'
}
const RECURRENCE_LABELS = { daily: 'يومي', weekly: 'أسبوعي', biweekly: 'كل أسبوعين', monthly: 'شهري', quarterly: 'ربع سنوي' }
const TASK_TYPE_ICONS = { task: '', report: '📋', meeting: '🗓' }

function formatDate(d) {
  if (!d) return null
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export default function TaskCard({
  task, onToggle, onEdit, onDelete, showToast,
  childCount = 0, isCollapsed, onToggleCollapse,
  isSubtask = false
}) {
  const [actionsOpen, setActionsOpen] = useState(false)
  const isParent = childCount > 0

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
    <div className={`task-card${task.done ? ' done' : ''}${isParent ? ' parent-task' : ''}${isSubtask ? ' subtask-card' : ''}`}>
      <div className="task-top">
        <button
          className={`task-check${task.done ? ' done' : ''}`}
          onClick={() => onToggle(task.id)}
          aria-label="إتمام المهمة"
        >
          {task.done && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
        </button>

        <div className="task-body" onClick={() => setActionsOpen(e => !e)} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div className={`task-title${task.done ? ' done' : ''}`}>{task.title}</div>
            {isParent && (
              <button
                className="collapse-toggle"
                onClick={e => { e.stopPropagation(); onToggleCollapse() }}
                aria-label={isCollapsed ? 'فتح' : 'طي'}
              >
                <span style={{ fontSize: 11, marginLeft: 3 }}>{childCount}</span>
                <span style={{ fontSize: 13, transition: 'transform 0.2s', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▾</span>
              </button>
            )}
          </div>
          <div className="task-meta">
            {task.taskType && task.taskType !== 'task' && (
              <span className="badge badge-date" style={{ background: task.taskType === 'report' ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)', color: task.taskType === 'report' ? '#818cf8' : '#fbbf24' }}>
                {TASK_TYPE_ICONS[task.taskType]} {task.taskType === 'report' ? 'تقرير' : 'اجتماع'}
              </span>
            )}
            <span className={`badge badge-${task.priority}`}>
              {PRIORITY_LABELS[task.priority]}
            </span>
            {task.category && CATEGORY_LABELS[task.category] && (
              <span className="badge badge-date">
                {CATEGORY_LABELS[task.category]}
              </span>
            )}
            {!task.category && task.subcategory && task.subcategory !== 'other' && (
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
            {task.projectName && (
              <span className="badge badge-project">📁 {task.projectName}</span>
            )}
          </div>
        </div>
      </div>

      {actionsOpen && (
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
