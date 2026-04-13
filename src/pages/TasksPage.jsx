import { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import TaskCard from '../components/TaskCard'
import TaskForm from '../components/TaskForm'
import ApiKeyInput from '../components/ApiKeyInput'
import SmartChat from '../components/SmartChat'
import { callClaude, EXTRACT_SYSTEM } from '../utils/claude'
import { deduplicateTasks, isDuplicateTask } from '../utils/dedup'
import { useAuth } from '../contexts/AuthContext'
import {
  addTask as dbAddTask,
  updateTask as dbUpdateTask,
  deleteTask as dbDeleteTask,
  createRequest,
} from '../utils/db'

const FILTERS = [
  { id: 'all',      label: 'الكل' },
  { id: 'active',   label: 'قيد التنفيذ' },
  { id: 'done',     label: 'مكتملة' },
  { id: 'urgent',   label: 'عاجل' },
  { id: 'mine',     label: 'مهامي' },
]

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

const REQUEST_LABELS = {
  add:        'إضافة مهمة جديدة',
  edit_title: 'تعديل عنوان المهمة',
  edit_date:  'تعديل تاريخ الاستحقاق',
  close:      'إغلاق / إتمام المهمة',
}

export default function TasksPage({ tasks, apiKey, setApiKey, showToast, userProfile }) {
  const { isAdmin, isSuperUser, isUser } = useAuth()
  const canWrite = isAdmin || isSuperUser   
  const [filter, setFilter]       = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showForm, setShowForm]   = useState(false)
  const [editTask, setEditTask]   = useState(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showSmartChat, setShowSmartChat] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [viewMode, setViewMode]   = useState('list')
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())
  const [showExportMenu, setShowExportMenu] = useState(false)

  const [pendingRequest, setPendingRequest] = useState(null)
  const [requestNote, setRequestNote] = useState('')
  const [submittingReq, setSubmittingReq] = useState(false)

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
      else if (filter === 'mine'     && (!t.person || t.person.trim() !== userProfile?.name)) return false
      
      if (!q) return true
      return (t.title || '').toLowerCase().includes(q)
          || (t.person || '').toLowerCase().includes(q)
          || (t.projectName || '').toLowerCase().includes(q)
    })
  }, [tasks, filter, searchQuery, userProfile])

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

  const taskGroups = useMemo(() => (
    filtered.filter(t => !t.parentId).map(t => ({ task: t, children: childrenMap[t.id] || [] }))
  ), [filtered, childrenMap])

  const kanbanColumns = useMemo(() => [
    { id: 'urgent', label: 'عاجل 🔴', tasks: filtered.filter(t => t.priority === 'urgent' && !t.done) },
    { id: 'active', label: 'قيد التنفيذ 🔵', tasks: filtered.filter(t => t.priority !== 'urgent' && !t.done) },
    { id: 'done',   label: 'مكتملة ✅', tasks: filtered.filter(t => t.done) },
  ], [filtered])

  const bubbleGroups = useMemo(() => [
    { id: 'urgent', label: 'عاجل',    color: 'var(--red)',    tasks: filtered.filter(t => t.priority === 'urgent') },
    { id: 'medium', label: 'متوسطة',  color: 'var(--orange)', tasks: filtered.filter(t => t.priority === 'medium') },
    { id: 'low',    label: 'منخفضة',  color: 'var(--green)',  tasks: filtered.filter(t => t.priority === 'low') },
  ], [filtered])

  const groupedByPerson = useMemo(() => {
    const map = {}
    filtered.forEach(t => {
      const key = t.person?.trim() || 'بدون مسؤول'
      if (!map[key]) map[key] = []
      map[key].push(t)
    })
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0], 'ar'))
  }, [filtered])

  const stats = useMemo(() => {
    const total  = tasks.length
    const done   = tasks.filter(t => t.done).length
    const urgent = tasks.filter(t => t.priority === 'urgent' && !t.done).length
    const pct    = total ? Math.round((done / total) * 100) : 0
    return { total, done, urgent, pending: total - done, pct }
  }, [tasks])

  function submitRequest(type, payload) {
    setPendingRequest({ type, payload, label: REQUEST_LABELS[type] })
    setRequestNote('')
  }

  async function confirmRequest() {
    if (!pendingRequest) return
    setSubmittingReq(true)
    try {
      await createRequest({
        type: pendingRequest.type,
        payload: { ...pendingRequest.payload, note: requestNote },
        requestedBy: userProfile.uid,
        requestedByName: userProfile.name,
      })
      showToast('📨 تم إرسال الطلب — بانتظار موافقة المدير')
    } catch (e) {
      showToast('❌ خطأ في إرسال الطلب')
    } finally {
      setSubmittingReq(false)
      setPendingRequest(null)
      setShowForm(false)
      setEditTask(null)
    }
  }

  async function addTask(form, subTaskTitles = []) {
    if (isDuplicateTask(form.title, tasks)) {
      showToast('⚠️ المهمة موجودة مسبقاً')
      setShowForm(false)
      return
    }
    if (!canWrite) {
      submitRequest('add', { ...form })
      setShowForm(false)
      return
    }
    try {
      await dbAddTask({ ...form, done: false })
      if (subTaskTitles.length > 0) {
        for (const title of subTaskTitles) {
          await dbAddTask({
            title, priority: form.priority, person: form.person,
            dueDate: '', recurrence: '', reminderTime: '',
            projectName: form.projectName || form.title,
            sourceType: form.sourceType, sourceTitle: form.sourceTitle, done: false,
          })
        }
        showToast(`✅ أضيفت المهمة و${subTaskTitles.length} مهام فرعية`)
      } else {
        showToast('✅ تمت إضافة المهمة')
      }
    } catch (e) { showToast('❌ خطأ في إضافة المهمة') }
    setShowForm(false)
  }

  async function updateTaskHandler(form) {
    if (!canWrite) {
      const original = tasks.find(t => t.id === form.id)
      if (original) {
        if (original.title !== form.title) {
          submitRequest('edit_title', { taskId: form.id, title: form.title, originalTitle: original.title })
        } else if (original.dueDate !== form.dueDate) {
          submitRequest('edit_date', { taskId: form.id, dueDate: form.dueDate, originalDate: original.dueDate })
        } else { showToast('⚠️ هذا التعديل يحتاج موافقة المدير') }
      }
      setEditTask(null)
      return
    }
    try {
      const { id, ...data } = form
      await dbUpdateTask(id, data)
      showToast('✏️ تم تعديل المهمة')
    } catch (e) { showToast('❌ خطأ في التعديل') }
    setEditTask(null)
  }

  async function toggleTask(id) {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    if (!canWrite && !task.done) {
      submitRequest('close', { taskId: id, taskTitle: task.title })
      return
    }
    const done = !task.done
    const updates = { done }
    if (done && task.recurrence) {
      const newDue = calcNextDue(task.dueDate, task.recurrence)
      Object.assign(updates, { done: false, dueDate: newDue, completedAt: null })
      showToast('🔄 تجددت المهمة المتكررة')
    } else if (done) {
      updates.completedAt = new Date().toISOString()
      showToast('🎉 أحسنت! تم إنجاز المهمة')
    } else { updates.completedAt = null }

    try { await dbUpdateTask(id, updates) } catch (e) { showToast('❌ خطأ في تحديث الحالة') }
  }

  async function deleteTask(id) {
    if (!canWrite) { showToast('⚠️ ليس لديك صلاحية الحذف'); return }
    try { await dbDeleteTask(id); showToast('🗑 تم حذف المهمة') } catch (e) { showToast('❌ خطأ في الحذف') }
    setDeleteConfirm(null)
  }

  async function handleSmartChatAdd(newTasks) {
    if (!canWrite) { showToast('⚠️ ليس لديك صلاحية الإضافة المباشرة'); return }
    const deduped = deduplicateTasks(newTasks, tasks)
    const skipped = newTasks.length - deduped.length
    for (const t of deduped) await dbAddTask({ ...t, done: false })
    if (deduped.length === 0) showToast('⚠️ جميع المهام موجودة مسبقاً')
    else showToast(`✅ تمت إضافة ${deduped.length} مهمة${skipped ? ` (تجاهل ${skipped} مكررة)` : ''}`)
  }

  function exportJSON() {
    if (!isAdmin) { showToast('⚠️ متاح للمدير فقط'); return }
    const data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tasks }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `مهامي-${new Date().toISOString().slice(0,10)}.json`
    a.click(); URL.revokeObjectURL(url)
    setShowExportMenu(false)
    showToast('✅ تم تنزيل النسخة الاحتياطية')
  }

  function exportCSV() {
    const headers = ['العنوان','الأولوية','الفئة','الشخص','تاريخ الاستحقاق','الحالة','المشروع']
    const rows = tasks.map(t => [
      `"${(t.title||'').replace(/"/g,'""')}"`, t.priority||'', t.category||'',
      `"${(t.person||'').replace(/"/g,'""')}"`, t.dueDate||'',
      t.done ? 'مكتملة' : 'معلقة',
      `"${(t.projectName||'').replace(/"/g,'""')}"`,
    ])
    const csv  = '\uFEFF' + [headers,...rows].map(r=>r.join(',')).join('\n')
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8'})
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `مهامي-${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
    setShowExportMenu(false)
    showToast('✅ تم تنزيل ملف CSV')
  }

    function exportExcel() {
    try {
      const EXCEL_COLUMNS = ['Channel','Sub_Source','Task title','Task description','What\'s Done','Type','Due date','Completion %']
      const dataToExport = tasks.map(t => {
        let finalDueDate = t.dueDate;
        if (!finalDueDate) {
          const d = new Date(t.createdAt || Date.now());
          let addedDays = 0;
          while (addedDays < 5) {
            d.setDate(d.getDate() + 1);
            if (d.getDay() !== 5 && d.getDay() !== 6) addedDays++;
          }
          finalDueDate = d.toISOString().split('T')[0];
        }
        return {
          [EXCEL_COLUMNS[0]]: t.sourceType || '', 
          [EXCEL_COLUMNS[1]]: 'مهامي برو',
          [EXCEL_COLUMNS[2]]: t.sourceTitle || '', 
          [EXCEL_COLUMNS[3]]: t.title || '', 
          [EXCEL_COLUMNS[4]]: t.closeNote || '', 
          [EXCEL_COLUMNS[5]]: t.projectName || '', 
          [EXCEL_COLUMNS[6]]: finalDueDate,
          [EXCEL_COLUMNS[7]]: t.done ? '100%' : '50%'
        };
      });
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Tasks Tracker");
      
      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LOC_Tasks_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      document.body.appendChild(a); 
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      setShowExportMenu(false);
      showToast('✅ تم تنزيل ملف Excel');
        } catch (error) {
      console.error("Excel export error:", error);
      showToast('❌ خطأ: ' + error.message);
    }

  // --- كود استيراد الإكسل الجديد ---
  function parseExcelDate(raw) {
    if (!raw) return ''
    if (raw instanceof Date) return raw.toISOString().split('T')[0]
    if (typeof raw === 'number') {
      const jsDate = new Date(Math.round((raw - 25569) * 86400 * 1000))
      return jsDate.toISOString().split('T')[0]
    }
    if (typeof raw === 'string') return raw.substring(0, 10)
    return ''
  }

  async function handleImportExcel(e) {
    const file = e.target.files[0]
    if (!file) return

    try {
      showToast('⏳ جاري قراءة الملف...')
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })

      const sheetName = workbook.SheetNames.find(n => n.trim() === 'Tasks Tracker')
      if (!sheetName) {
        showToast('❌ لم يتم العثور على شيت Tasks Tracker')
        return
      }

      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })
      const existingTitles = new Set(tasks.map(t => (t.title || '').trim()))

      let added = 0, skipped = 0

      for (const row of rows) {
        const title = (row['Task description'] || row['Task Description'] || '').trim()
        if (!title) continue
        if (existingTitles.has(title)) { skipped++; continue }

        const completion = row['Completion %']
        const done = (typeof completion === 'number' && completion >= 1) ||
                     (typeof completion === 'string' && completion.includes('100'))

        await dbAddTask({
          title,
          sourceTitle:  (row['Task title'] || row['Task Title'] || '').trim(),
          sourceType:   (row['Channel']    || row['Channel ']   || '').trim(),
          projectName:  (row['Type']       || '').trim(),
          closeNote:    (row["What's Done"] || '').trim(),
          dueDate:      parseExcelDate(row['Due date'] || row['Due Date']),
          done,
          priority:     'medium',
          person:       '',
        })

        existingTitles.add(title)
        added++
      }

      setShowExportMenu(false)
      showToast(`✅ تم استيراد ${added} مهمة وتجاهل ${skipped} مكررة`)
    } catch (err) {
      console.error('Excel import error:', err)
      showToast('❌ خطأ في الاستيراد: ' + err.message)
    } finally {
      e.target.value = ''
    }
  }
  // --- نهاية كود الاستيراد ---

  function handleImportJSON(e) {
    if (!canWrite) { showToast('⚠️ ليس لديك صلاحية الاستيراد'); return }
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result)
        const imported = Array.isArray(data) ? data : (data.tasks || [])
        if (!imported.length) { showToast('❌ لا توجد مهام في الملف'); return }
        const existing = new Set(tasks.map(t => t.title.trim().toLowerCase()))
        const newOnes  = imported.filter(t => !existing.has((t.title||'').trim().toLowerCase()))
        for (const t of newOnes) await dbAddTask({ ...t, done: t.done || false })
        showToast(`✅ استُعيد ${newOnes.length} مهمة جديدة`)
      } catch { showToast('❌ ملف JSON غير صحيح') }
    }
    reader.readAsText(file)
    e.target.value = ''
    setShowExportMenu(false)
  }

  const circumference = 2 * Math.PI * 40

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="header" style={{ paddingBottom: '10px' }}>
        <div className="header-row">
          <div>
            <div className="header-title">مهامي Pro</div>
            <div className="header-sub">{userProfile?.name} • PMO مركز عمليات المختبرات</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
            
            {/* 🔴 إخفاء قائمة التصدير كاملة عن الموظف العادي */}
            {!isUser && (
              <button onClick={() => setShowExportMenu(s => !s)} style={{
                  background: 'rgba(99,102,241,0.12)', color: '#818cf8',
                  border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8,
                  padding: '6px 10px', fontSize: 13, fontFamily: 'var(--font)', cursor: 'pointer',
                }}>⬇️</button>
            )}

            {showExportMenu && !isUser && (
              <div style={{
                position: 'absolute', top: 38, right: 0, zIndex: 200,
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 8, minWidth: 170,
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <button onClick={exportExcel} style={menuBtnStyle}><span>📗</span> تنزيل Excel</button>
                {isAdmin && <button onClick={exportJSON} style={menuBtnStyle}><span>💾</span> تنزيل JSON</button>}
                <button onClick={exportCSV} style={menuBtnStyle}><span>📊</span> تنزيل CSV</button>
                <label style={{ ...menuBtnStyle, cursor: 'pointer' }}>
  <span style={{ marginRight: 8 }}>📥</span> استيراد Excel
  <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportExcel} />
</label>
                {canWrite && (
                  <>
                    <div style={{ height: 1, background: 'var(--border)', margin: '2px 8px' }} />
                    <label style={{ ...menuBtnStyle, cursor: 'pointer' }}>
                      <span>📂</span> استيراد JSON
                      <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportJSON} />
                    </label>
                  </>
                )}
              </div>
            )}
            {showExportMenu && <div onClick={() => setShowExportMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />}
            
            <button onClick={cycleView} title={VIEW_MODES.find(v => v.id === viewMode)?.label} style={{
              background: 'rgba(59,130,246,0.12)', color: 'var(--blue-light)',
              border: '1px solid rgba(59,130,246,0.25)', borderRadius: 8,
              padding: '6px 10px', fontSize: 13, fontFamily: 'var(--font)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span>{VIEW_MODES.find(v => v.id === viewMode)?.icon}</span>
              <span style={{ fontSize: 11 }}>{VIEW_MODES.find(v => v.id === viewMode)?.label}</span>
            </button>
            
            {/* 🔴 إخفاء زر الـ API عن الموظف العادي */}
            {!isUser && (
              <button onClick={() => setShowApiKey(true)} style={{
                background: apiKey ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                color: apiKey ? 'var(--green)' : 'var(--orange)',
                border: 'none', borderRadius: 8, padding: '6px 10px',
                fontSize: 12, fontFamily: 'var(--font)', cursor: 'pointer',
              }}>
                {apiKey ? '🔑 API' : '⚙️ API'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="page" style={{ paddingBottom: '90px' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 12 }}>
          <div className="ring-container" style={{ width: 80, height: 80 }}>
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="var(--bg3)" strokeWidth="10" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="url(#grad)" strokeWidth="10"
                strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - stats.pct / 100)} />
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="ring-center">
              <span className="ring-pct">{stats.pct}%</span><span className="ring-text">إنجاز</span>
            </div>
          </div>
          <div className="stats-bar" style={{ flex: 1, padding: 0 }}>
            <div className="stat-card"><div className="stat-num" style={{ color: 'var(--text2)' }}>{stats.pending}</div><div className="stat-label">معلقة</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: 'var(--red)' }}>{stats.urgent}</div><div className="stat-label">عاجل</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: 'var(--green)' }}>{stats.done}</div><div className="stat-label">مكتملة</div></div>
          </div>
        </div>

        {isUser && (
          <div style={{
            margin: '0 16px 8px', padding: '10px 14px', borderRadius: 12,
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
            fontSize: 12, color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>ℹ️</span><span>صلاحيتك: الإضافة / التعديل / الإغلاق تحتاج موافقة المدير</span>
          </div>
        )}

        <div style={{ padding: '0 16px 8px', position: 'relative' }}>
          <span style={{ position: 'absolute', right: 28, top: '50%', transform: 'translateY(-50%)', fontSize: 15, opacity: 0.45 }}>🔍</span>
          <input type="search" placeholder="ابحث في المهام..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '9px 38px 9px 12px', borderRadius: 12,
              border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14, outline: 'none',
            }}
          />
          {searchQuery && <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', left: 28, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: 13, opacity: 0.5, color: 'var(--text)', padding: 2 }}>✕</button>}
        </div>

        <div className="filters" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '5px' }}>
          {FILTERS.map(f => (
            <button key={f.id} className={`filter-btn${filter === f.id ? ' active' : ''}`} onClick={() => setFilter(f.id)}>{f.label}</button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📋</div><div className="empty-text">لا توجد مهام</div></div>
        ) : viewMode === 'list' ? (
          <div className="task-list">
            {taskGroups.map(({ task, children }) => (
              <div key={task.id} className="task-group">
                <TaskCard task={task} onToggle={toggleTask} onEdit={setEditTask} onDelete={canWrite ? id => setDeleteConfirm(id) : null} showToast={showToast} childCount={children.length} isCollapsed={collapsedGroups.has(task.id)} onToggleCollapse={() => toggleCollapse(task.id)} />
                {children.length > 0 && !collapsedGroups.has(task.id) && (
                  <div className="subtask-group">
                    {children.map(c => <TaskCard key={c.id} task={c} onToggle={toggleTask} onEdit={setEditTask} onDelete={canWrite ? id => setDeleteConfirm(id) : null} showToast={showToast} isSubtask />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : viewMode === 'compact' ? (
          <div className="compact-list">
            {filtered.map(task => (
              <div key={task.id} className={`compact-row${task.done ? ' done' : ''}${task.parentId ? ' is-subtask' : ''}`}>
                <button className={`task-check${task.done ? ' done' : ''}`} style={{ flexShrink: 0, width: 18, height: 18, fontSize: 10 }} onClick={() => toggleTask(task.id)}>{task.done && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}</button>
                <div className="compact-title" onClick={() => setEditTask(task)}>{task.title}</div>
                <span className={`compact-dot priority-dot-${task.priority}`} />
              </div>
            ))}
          </div>
        ) : viewMode === 'grouped' ? (
          <div className="grouped-list">
            {groupedByPerson.map(([person, personTasks]) => (
              <div key={person} className="person-group">
                <div className="person-group-header"><span className="person-group-icon">👤</span><span className="person-group-name">{person}</span><span className="person-group-count">{personTasks.length}</span></div>
                <div className="person-group-tasks">
                  {personTasks.map(task => (
                    <div key={task.id} className={`compact-row${task.done ? ' done' : ''}`}>
                      <button className={`task-check${task.done ? ' done' : ''}`} style={{ flexShrink: 0, width: 18, height: 18, fontSize: 10 }} onClick={() => toggleTask(task.id)}>{task.done && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}</button>
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
                <div className="kanban-col-header"><span className="kanban-col-label">{col.label}</span><span className="kanban-col-count">{col.tasks.length}</span></div>
                <div className="kanban-cards">
                  {col.tasks.map(task => (
                    <div key={task.id} className="kanban-card" onClick={() => setEditTask(task)}><div className="kanban-card-title">{task.title}</div>{task.person && <div className="kanban-card-person">👤 {task.person}</div>}{task.dueDate && <div className="kanban-card-date">📅 {task.dueDate}</div>}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* 🔴 إصلاح الأزرار العائمة (FABs) ورفعها عن الشريط السفلي */}
        <button className="fab" onClick={() => setShowForm(true)} aria-label="إضافة مهمة" style={{ bottom: 90, zIndex: 100 }}>+</button>
        
        {/* 🔴 إخفاء المحادثة الذكية عن الموظف لأنها تحتاج API */}
        <button className="extract-fab" onClick={() => setShowSmartChat(true)} style={{ bottom: 90, zIndex: 100 }}>💬 محادثة ذكية</button>


        {showForm && <TaskForm task={null} onSave={addTask} onClose={() => setShowForm(false)} apiKey={apiKey} />}
        {editTask && <TaskForm task={editTask} onSave={updateTaskHandler} onClose={() => setEditTask(null)} apiKey={apiKey} />}
        {showApiKey && <ApiKeyInput apiKey={apiKey} setApiKey={setApiKey} onClose={() => setShowApiKey(false)} />}
        {showSmartChat && <SmartChat tasks={tasks} apiKey={apiKey} onAddTasks={handleSmartChatAdd} onClose={() => setShowSmartChat(false)} />}

        {deleteConfirm && (
          <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
            <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
              <div className="confirm-title">حذف المهمة</div>
              <div className="confirm-msg">هل أنت متأكد من حذف هذه المهمة؟ لا يمكن التراجع.</div>
              <div className="confirm-btns">
                <button className="confirm-btn-yes" onClick={() => deleteTask(deleteConfirm)}>حذف</button>
                <button className="confirm-btn-no" onClick={() => setDeleteConfirm(null)}>إلغاء</button>
              </div>
            </div>
          </div>
        )}

        {pendingRequest && (
          <div className="modal-overlay" onClick={() => setPendingRequest(null)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
              <div className="modal-handle" />
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📨</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>إرسال طلب للمدير</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6 }}>{pendingRequest.label}</div>
              </div>
              {pendingRequest.type === 'close' && (
                <div style={{ fontSize: 12, color: 'var(--blue)', background: 'rgba(59, 130, 246, 0.1)', padding: '8px 12px', borderRadius: 8, marginBottom: 12, lineHeight: 1.6 }}>
                  💡 يرجى كتابة ما تم إنجازه بوضوح وبصيغة مهنية لتوثيق اكتمال المهمة.
                </div>
              )}
              <div className="form-group">
                <label className="form-label">ملاحظة (اختياري)</label>
                <input className="form-input" value={requestNote} onChange={e => setRequestNote(e.target.value)} placeholder={pendingRequest.type === 'close' ? "اكتب ما تم إنجازه هنا..." : "أضف سبباً أو تفصيلاً..."} />
              </div>
              <button className="submit-btn" onClick={confirmRequest} disabled={submittingReq}>{submittingReq ? 'جارٍ الإرسال...' : 'إرسال الطلب'}</button>
              <button className="cancel-btn" onClick={() => setPendingRequest(null)}>إلغاء</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const menuBtnStyle = { background: 'none', border: 'none', color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 13, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'right', display: 'flex', gap: 8, alignItems: 'center' }

function calcNextDue(currentDue, recurrence) {
  if (!currentDue) return ''
  const d = new Date(currentDue)
  if (recurrence === 'daily') d.setDate(d.getDate() + 1)
  else if (recurrence === 'weekly') d.setDate(d.getDate() + 7)
  else if (recurrence === 'monthly') d.setMonth(d.getMonth() + 1)
  return d.toISOString().split('T')[0]
}
