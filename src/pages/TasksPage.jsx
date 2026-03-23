import { useState, useMemo } from 'react'
import TaskCard from '../components/TaskCard'
import TaskForm from '../components/TaskForm'
import ApiKeyInput from '../components/ApiKeyInput'
import SmartChat from '../components/SmartChat'
import { callClaude, EXTRACT_SYSTEM } from '../utils/claude'
import { deduplicateTasks, isDuplicateTask } from '../utils/dedup'

const MY_NAMES = ['علي الزهراني', 'ali alzahrani', 'ali', 'علي']

const FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'active', label: 'قيد التنفيذ' },
  { id: 'done', label: 'مكتملة' },
  { id: 'urgent', label: 'عاجل' },
  { id: 'mine', label: 'مهامي' },
  { id: 'work', label: 'العمل' },
  { id: 'personal', label: 'شخصي' },
]

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export default function TasksPage({ tasks, setTasks, apiKey, setApiKey, showToast }) {
  const [filter, setFilter]       = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showSmartChat, setShowSmartChat] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [viewMode, setViewMode] = useState('list') // list | compact | grouped | kanban | bubbles
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())
  const [showExportMenu, setShowExportMenu] = useState(false)

  const VIEW_MODES = [
    { id: 'list',    icon: '▤', label: 'قائمة' },
    { id: 'compact', icon: '☰', label: 'مضغوط' },
    { id: 'grouped', icon: '👥', label: 'حسب الشخص' },
    { id: 'kanban',  icon: '⬛', label: 'كانبان' },
    { id: 'bubbles', icon: '◉', label: 'فقاعات' },
  ]
  function cycleView() {
    setViewMode(cur => {
      const idx = VIEW_MODES.findIndex(v => v.id === cur)
      return VIEW_MODES[(idx + 1) % VIEW_MODES.length].id
    })
  }

  function toggleCollapse(id) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return tasks.filter(t => {
      if (filter === 'all') {}
      else if (filter === 'active'   && t.done) return false
      else if (filter === 'done'     && !t.done) return false
      else if (filter === 'urgent'   && t.priority !== 'urgent') return false
      else if (filter === 'mine'     && !MY_NAMES.some(n => t.person?.toLowerCase().includes(n.toLowerCase()))) return false
      else if (filter === 'work'     && t.category !== 'work') return false
      else if (filter === 'personal' && t.category !== 'personal') return false
      if (!q) return true
      return (t.title || '').toLowerCase().includes(q)
          || (t.person || '').toLowerCase().includes(q)
          || (t.projectName || '').toLowerCase().includes(q)
    })
  }, [tasks, filter, searchQuery])

  // Parent→children map from ALL tasks
  const childrenMap = useMemo(() => {
    const map = {}
    tasks.forEach(t => {
      if (t.parentId) {
        if (!map[t.parentId]) map[t.parentId] = []
        map[t.parentId].push(t)
      }
    })
    return map
  }, [tasks])

  // Top-level task groups with their children (for list view hierarchy)
  const taskGroups = useMemo(() => {
    return filtered
      .filter(t => !t.parentId)
      .map(t => ({ task: t, children: childrenMap[t.id] || [] }))
  }, [filtered, childrenMap])

  // Kanban columns
  const kanbanColumns = useMemo(() => [
    { id: 'urgent', label: 'عاجل 🔴', tasks: filtered.filter(t => t.priority === 'urgent' && !t.done) },
    { id: 'active', label: 'قيد التنفيذ 🔵', tasks: filtered.filter(t => t.priority !== 'urgent' && !t.done) },
    { id: 'done',   label: 'مكتملة ✅', tasks: filtered.filter(t => t.done) },
  ], [filtered])

  // Bubbles: group by priority
  const bubbleGroups = useMemo(() => [
    { id: 'urgent', label: 'عاجل', color: 'var(--red)',    tasks: filtered.filter(t => t.priority === 'urgent') },
    { id: 'medium', label: 'متوسطة', color: 'var(--orange)', tasks: filtered.filter(t => t.priority === 'medium') },
    { id: 'low',    label: 'منخفضة', color: 'var(--green)',  tasks: filtered.filter(t => t.priority === 'low') },
  ], [filtered])

  const stats = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter(t => t.done).length
    const urgent = tasks.filter(t => t.priority === 'urgent' && !t.done).length
    const pct = total ? Math.round((done / total) * 100) : 0
    return { total, done, urgent, pending: total - done, pct }
  }, [tasks])

  function addTask(form, subTaskTitles = []) {
    if (isDuplicateTask(form.title, tasks)) {
      showToast('⚠️ المهمة موجودة مسبقاً')
      setShowForm(false)
      return
    }
    const parentId = genId()
    const newTask = { ...form, id: parentId, createdAt: Date.now() }

    if (subTaskTitles.length > 0) {
      const subTaskObjects = subTaskTitles.map(title => ({
        title,
        priority: form.priority,
        category: form.category,
        subcategory: form.subcategory,
        person: form.person,
        dueDate: '',
        recurrence: '',
        reminderTime: '',
        projectName: form.projectName || form.title,
        parentId,
        done: false,
        id: genId(),
        createdAt: Date.now(),
      }))
      setTasks([newTask, ...subTaskObjects, ...tasks])
      showToast(`✅ تمت إضافة المهمة و${subTaskTitles.length} مهام فرعية`)
    } else {
      setTasks([newTask, ...tasks])
      showToast('✅ تمت إضافة المهمة')
    }
    setShowForm(false)
  }

  function updateTask(form) {
    setTasks(tasks.map(t => t.id === form.id ? { ...t, ...form } : t))
    setEditTask(null)
    showToast('✏️ تم تعديل المهمة')
  }

  function toggleTask(id) {
    setTasks(tasks.map(t => {
      if (t.id !== id) return t
      const done = !t.done
      let updated = { ...t, done }
      if (done && t.recurrence) {
        const newDue = calcNextDue(t.dueDate, t.recurrence)
        updated = { ...updated, done: false, dueDate: newDue, completedAt: null }
        showToast('🔄 تجددت المهمة المتكررة')
      } else if (done) {
        updated = { ...updated, completedAt: new Date().toISOString() }
        showToast('🎉 أحسنت! تم إنجاز المهمة')
      } else {
        updated = { ...updated, completedAt: null }
      }
      return updated
    }))
  }

  function deleteTask(id) {
    setTasks(tasks.filter(t => t.id !== id))
    setDeleteConfirm(null)
    showToast('🗑 تم حذف المهمة')
  }

  function handleSmartChatAdd(newTasks) {
    const deduped = deduplicateTasks(newTasks, tasks)
    const skippedCount = newTasks.length - deduped.length
    setTasks([...deduped, ...tasks])
    if (deduped.length === 0) {
      showToast('⚠️ جميع المهام موجودة مسبقاً')
    } else {
      showToast(`✅ تمت إضافة ${deduped.length} مهمة${skippedCount ? ` (تجاهل ${skippedCount} مكررة)` : ''}`)
    }
  }

  // Grouped by person (for grouped view)
  const groupedByPerson = useMemo(() => {
    const map = {}
    filtered.forEach(t => {
      const key = t.person?.trim() || 'بدون مسؤول'
      if (!map[key]) map[key] = []
      map[key].push(t)
    })
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0], 'ar'))
  }, [filtered])

  const circumference = 2 * Math.PI * 40

  function exportJSON() {
    const data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tasks }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `مهامي-نسخة-احتياطية-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setShowExportMenu(false)
    showToast('✅ تم تنزيل النسخة الاحتياطية')
  }

  function exportCSV() {
    const headers = ['العنوان', 'الأولوية', 'الفئة', 'الشخص', 'تاريخ الاستحقاق', 'الحالة', 'المشروع']
    const rows = tasks.map(t => [
      `"${(t.title || '').replace(/"/g, '""')}"`,
      t.priority || '',
      t.category || '',
      `"${(t.person || '').replace(/"/g, '""')}"`,
      t.dueDate || '',
      t.done ? 'مكتملة' : 'معلقة',
      `"${(t.projectName || '').replace(/"/g, '""')}"`,
    ])
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `مهامي-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setShowExportMenu(false)
    showToast('✅ تم تنزيل ملف CSV')
  }

  function handleImportJSON(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result)
        const imported = Array.isArray(data) ? data : (data.tasks || [])
        if (!imported.length) { showToast('❌ لا توجد مهام في الملف'); return }
        const existing = new Set(tasks.map(t => t.title.trim().toLowerCase()))
        const newOnes = imported.filter(t => !existing.has((t.title || '').trim().toLowerCase()))
        setTasks([...newOnes, ...tasks])
        showToast(`✅ استُعيد ${newOnes.length} مهمة جديدة`)
      } catch {
        showToast('❌ ملف JSON غير صحيح')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
    setShowExportMenu(false)
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Header — outside the scroll container to avoid iOS sticky-in-overflow bug */}
      <div className="header">
        <div className="header-row">
          <div>
            <div className="header-title">مهامي Pro</div>
            <div className="header-sub">علي الزهراني • PMO وزارة الصحة</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
            {/* Export/Import menu */}
            <button
              onClick={() => setShowExportMenu(s => !s)}
              title="تصدير / استيراد"
              style={{
                background: 'rgba(99,102,241,0.12)',
                color: '#818cf8',
                border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 13,
                fontFamily: 'var(--font)',
                cursor: 'pointer',
              }}
            >
              ⬇️
            </button>
            {showExportMenu && (
              <div style={{
                position: 'absolute', top: 38, right: 0, zIndex: 200,
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 8, minWidth: 170,
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <button onClick={exportJSON} style={{
                  background: 'none', border: 'none', color: 'var(--text1)', fontFamily: 'var(--font)',
                  fontSize: 13, padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                  textAlign: 'right', display: 'flex', gap: 8, alignItems: 'center',
                }}>
                  <span>💾</span> تنزيل JSON
                </button>
                <button onClick={exportCSV} style={{
                  background: 'none', border: 'none', color: 'var(--text1)', fontFamily: 'var(--font)',
                  fontSize: 13, padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                  textAlign: 'right', display: 'flex', gap: 8, alignItems: 'center',
                }}>
                  <span>📊</span> تنزيل CSV
                </button>
                <div style={{ height: 1, background: 'var(--border)', margin: '2px 8px' }} />
                <label style={{
                  color: 'var(--text1)', fontFamily: 'var(--font)',
                  fontSize: 13, padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                  textAlign: 'right', display: 'flex', gap: 8, alignItems: 'center',
                }}>
                  <span>📂</span> استيراد JSON
                  <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportJSON} />
                </label>
              </div>
            )}
            {showExportMenu && (
              <div onClick={() => setShowExportMenu(false)} style={{
                position: 'fixed', inset: 0, zIndex: 199,
              }} />
            )}
            <button
              onClick={cycleView}
              title={VIEW_MODES.find(v => v.id === viewMode)?.label}
              style={{
                background: 'rgba(59,130,246,0.12)',
                color: 'var(--blue-light)',
                border: '1px solid rgba(59,130,246,0.25)',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 13,
                fontFamily: 'var(--font)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>{VIEW_MODES.find(v => v.id === viewMode)?.icon}</span>
              <span style={{ fontSize: 11 }}>{VIEW_MODES.find(v => v.id === viewMode)?.label}</span>
            </button>
            <button
              onClick={() => setShowApiKey(true)}
              style={{
                background: apiKey ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                color: apiKey ? 'var(--green)' : 'var(--orange)',
                border: 'none',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 12,
                fontFamily: 'var(--font)',
                cursor: 'pointer'
              }}
            >
              {apiKey ? '🔑 API' : '⚙️ API'}
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable content — separate from header to prevent iOS scroll freeze */}
      <div className="page">

      {/* Stats */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 12 }}>
        <div className="ring-container" style={{ width: 80, height: 80 }}>
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="var(--bg3)" strokeWidth="10" />
            <circle
              cx="50" cy="50" r="40" fill="none"
              stroke="url(#grad)" strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - stats.pct / 100)}
            />
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="ring-center">
            <span className="ring-pct">{stats.pct}%</span>
            <span className="ring-text">إنجاز</span>
          </div>
        </div>

        <div className="stats-bar" style={{ flex: 1, padding: 0 }}>
          <div className="stat-card">
            <div className="stat-num" style={{ color: 'var(--text2)' }}>{stats.pending}</div>
            <div className="stat-label">معلقة</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color: 'var(--red)' }}>{stats.urgent}</div>
            <div className="stat-label">عاجل</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color: 'var(--green)' }}>{stats.done}</div>
            <div className="stat-label">مكتملة</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '0 16px 8px', position: 'relative' }}>
        <span style={{
          position: 'absolute', right: 28, top: '50%', transform: 'translateY(-50%)',
          fontSize: 15, pointerEvents: 'none', opacity: 0.45,
        }}>🔍</span>
        <input
          type="search"
          placeholder="ابحث في المهام..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '9px 38px 9px 12px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--card)',
            color: 'var(--text)',
            fontSize: 14,
            fontFamily: 'inherit',
            direction: 'rtl',
            outline: 'none',
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute', left: 28, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, opacity: 0.5, color: 'var(--text)', padding: 2,
            }}
          >✕</button>
        )}
      </div>

      {/* Filters */}
      <div className="filters">
        {FILTERS.map(f => (
          <button
            key={f.id}
            className={`filter-btn${filter === f.id ? ' active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Tasks */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-text">لا توجد مهام</div>
          <div className="empty-sub">اضغط + لإضافة مهمة جديدة</div>
        </div>

      ) : viewMode === 'list' ? (
        <div className="task-list">
          {taskGroups.map(({ task, children }) => (
            <div key={task.id} className="task-group">
              <TaskCard
                task={task}
                onToggle={toggleTask}
                onEdit={setEditTask}
                onDelete={id => setDeleteConfirm(id)}
                showToast={showToast}
                childCount={children.length}
                isCollapsed={collapsedGroups.has(task.id)}
                onToggleCollapse={() => toggleCollapse(task.id)}
              />
              {children.length > 0 && !collapsedGroups.has(task.id) && (
                <div className="subtask-group">
                  {children.map(c => (
                    <TaskCard
                      key={c.id}
                      task={c}
                      onToggle={toggleTask}
                      onEdit={setEditTask}
                      onDelete={id => setDeleteConfirm(id)}
                      showToast={showToast}
                      isSubtask
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

      ) : viewMode === 'compact' ? (
        <div className="compact-list">
          {filtered.map(task => (
            <div key={task.id} className={`compact-row${task.done ? ' done' : ''}${task.parentId ? ' is-subtask' : ''}`}>
              <button
                className={`task-check${task.done ? ' done' : ''}`}
                style={{ flexShrink: 0, width: 18, height: 18, fontSize: 10 }}
                onClick={() => toggleTask(task.id)}
              >
                {task.done && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
              </button>
              <div className="compact-title" onClick={() => setEditTask(task)}>{task.title}</div>
              <span className={`compact-dot priority-dot-${task.priority}`} />
            </div>
          ))}
        </div>

      ) : viewMode === 'grouped' ? (
        <div className="grouped-list">
          {groupedByPerson.map(([person, personTasks]) => (
            <div key={person} className="person-group">
              <div className="person-group-header">
                <span className="person-group-icon">👤</span>
                <span className="person-group-name">{person}</span>
                <span className="person-group-count">{personTasks.length}</span>
              </div>
              <div className="person-group-tasks">
                {personTasks.map(task => (
                  <div key={task.id} className={`compact-row${task.done ? ' done' : ''}`}>
                    <button
                      className={`task-check${task.done ? ' done' : ''}`}
                      style={{ flexShrink: 0, width: 18, height: 18, fontSize: 10 }}
                      onClick={() => toggleTask(task.id)}
                    >
                      {task.done && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
                    </button>
                    <div className="compact-title" onClick={() => setEditTask(task)}>{task.title}</div>
                    <span className={`compact-dot priority-dot-${task.priority}`} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      ) : viewMode === 'kanban' ? (
        <div className="kanban-board">
          {kanbanColumns.map(col => (
            <div key={col.id} className={`kanban-col kanban-col-${col.id}`}>
              <div className="kanban-col-header">
                <span className="kanban-col-label">{col.label}</span>
                <span className="kanban-col-count">{col.tasks.length}</span>
              </div>
              <div className="kanban-cards">
                {col.tasks.map(task => (
                  <div key={task.id} className="kanban-card" onClick={() => setEditTask(task)}>
                    <div className="kanban-card-title">{task.title}</div>
                    {task.person && <div className="kanban-card-person">👤 {task.person}</div>}
                    {task.dueDate && <div className="kanban-card-date">📅 {task.dueDate}</div>}
                  </div>
                ))}
                {col.tasks.length === 0 && (
                  <div className="kanban-empty">لا توجد مهام</div>
                )}
              </div>
            </div>
          ))}
        </div>

      ) : viewMode === 'bubbles' ? (
        <div className="bubbles-view">
          {bubbleGroups.map(group => (
            <div key={group.id} className="bubble-group">
              <div className="bubble-group-header" style={{ color: group.color }}>
                <span className="bubble-group-label">{group.label}</span>
                <span className="bubble-group-count" style={{ background: group.color }}>{group.tasks.length}</span>
              </div>
              <div className="bubble-list">
                {group.tasks.map(task => (
                  <div
                    key={task.id}
                    className={`bubble-card${task.done ? ' done' : ''}`}
                    style={{ borderColor: group.color + '50' }}
                    onClick={() => setEditTask(task)}
                  >
                    <button
                      className={`task-check${task.done ? ' done' : ''}`}
                      style={{ flexShrink: 0, width: 20, height: 20, fontSize: 11 }}
                      onClick={e => { e.stopPropagation(); toggleTask(task.id) }}
                    >
                      {task.done && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className={`bubble-title${task.done ? ' done' : ''}`}>{task.title}</div>
                      {task.person && <div className="bubble-person">👤 {task.person}</div>}
                    </div>
                    <span className="bubble-dot" style={{ background: group.color }} />
                  </div>
                ))}
                {group.tasks.length === 0 && (
                  <div className="bubble-empty">لا توجد مهام</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* FAB Add */}
      <button className="fab" onClick={() => setShowForm(true)} aria-label="إضافة مهمة">
        +
      </button>

      {/* FAB Smart Chat */}
      <button className="extract-fab" onClick={() => setShowSmartChat(true)}>
        💬 محادثة ذكية
      </button>

      {/* Modals */}
      {showForm && (
        <TaskForm onSave={addTask} onClose={() => setShowForm(false)} apiKey={apiKey} />
      )}
      {editTask && (
        <TaskForm task={editTask} onSave={updateTask} onClose={() => setEditTask(null)} apiKey={apiKey} />
      )}
      {showApiKey && (
        <ApiKeyInput apiKey={apiKey} setApiKey={setApiKey} onClose={() => setShowApiKey(false)} />
      )}

      {/* Smart Chat */}
      {showSmartChat && (
        <SmartChat
          tasks={tasks}
          apiKey={apiKey}
          onAddTasks={handleSmartChatAdd}
          onClose={() => setShowSmartChat(false)}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <div className="confirm-title">حذف المهمة</div>
            <div className="confirm-msg">هل أنت متأكد من حذف هذه المهمة؟ لا يمكن التراجع.</div>
            <div className="confirm-btns">
              <button className="confirm-btn-yes" onClick={() => deleteTask(deleteConfirm)}>
                حذف
              </button>
              <button className="confirm-btn-no" onClick={() => setDeleteConfirm(null)}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      </div>{/* end .page */}
    </div>
  )
}

function calcNextDue(currentDue, recurrence) {
  if (!currentDue) return ''
  const d = new Date(currentDue)
  if (recurrence === 'daily') d.setDate(d.getDate() + 1)
  else if (recurrence === 'weekly') d.setDate(d.getDate() + 7)
  else if (recurrence === 'monthly') d.setMonth(d.getMonth() + 1)
  return d.toISOString().split('T')[0]
}
