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

const REQUEST_LABELS = {
  add:        'إضافة مهمة جديدة',
  edit_title: 'تعديل عنوان المهمة',
  edit_date:  'تعديل تاريخ الاستحقاق',
  close:      'إغلاق / إتمام المهمة',
}

export default function TasksPage({ tasks, apiKey, setApiKey, showToast, userProfile }) {
  const envApiKey = import.meta.env.VITE_CLAUDE_API_KEY;
  const currentApiKey = apiKey || envApiKey || '';

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

  const stats = useMemo(() => {
    const total  = tasks.length
    const done   = tasks.filter(t => t.done).length
    const urgent = tasks.filter(t => t.priority === 'urgent' && !t.done).length
    const pct    = total ? Math.round((done / total) * 100) : 0
    return { total, done, urgent, pending: total - done, pct }
  }, [tasks])

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
      setPendingRequest({ type: 'add', payload: { ...form }, label: REQUEST_LABELS.add })
      setShowForm(false)
      return
    }
    try {
      await dbAddTask({ ...form, done: false })
      showToast('✅ تمت إضافة المهمة')
    } catch (e) { showToast('❌ خطأ في إضافة المهمة') }
    setShowForm(false)
  }

  async function updateTaskHandler(form) {
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
    const done = !task.done
    try { 
      await dbUpdateTask(id, { done, completedAt: done ? new Date().toISOString() : null }) 
      showToast(done ? '🎉 تم الإنجاز' : '🔄 أعيدت للتنفيذ')
    } catch (e) { showToast('❌ خطأ في التحديث') }
  }

  async function deleteTask(id) {
    try { await dbDeleteTask(id); showToast('🗑 تم حذف المهمة') } catch (e) { showToast('❌ خطأ في الحذف') }
    setDeleteConfirm(null)
  }

  async function handleSmartChatAdd(newTasks) {
    const deduped = deduplicateTasks(newTasks, tasks)
    for (const t of deduped) await dbAddTask({ ...t, done: false })
    showToast(`✅ تمت إضافة ${deduped.length} مهمة`)
  }

  function exportExcel() {
    try {
      // مسميات أعمدة واضحة لضمان سهولة القراءة وإعادة الاستيراد
      const EXCEL_COLUMNS = ['مصدر المهمة', 'عنوان المصدر', 'عنوان المهمة', 'اسم المشروع', 'المسؤول', 'تاريخ الاستحقاق', 'نسبة الإنجاز', 'ملاحظات الإنجاز']
      const dataToExport = tasks.map(t => ({
        [EXCEL_COLUMNS[0]]: t.sourceType || '', 
        [EXCEL_COLUMNS[1]]: t.sourceTitle || '', 
        [EXCEL_COLUMNS[2]]: t.title || '', 
        [EXCEL_COLUMNS[3]]: t.projectName || '', 
        [EXCEL_COLUMNS[4]]: t.person || '', 
        [EXCEL_COLUMNS[5]]: t.dueDate || '', 
        [EXCEL_COLUMNS[6]]: t.done ? '100%' : '0%',
        [EXCEL_COLUMNS[7]]: t.closeNote || ''
      }));
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Tasks Tracker");
      XLSX.writeFile(workbook, `PMO_Tasks_${new Date().toISOString().split('T')[0]}.xlsx`);
      setShowExportMenu(false);
      showToast('✅ تم تصدير الملف بنجاح');
    } catch (error) { showToast('❌ خطأ في التصدير'); }
  }

  function parseExcelDate(raw) {
    if (!raw) return ''
    if (raw instanceof Date) return raw.toISOString().split('T')[0]
    if (typeof raw === 'number') return new Date(Math.round((raw - 25569) * 86400 * 1000)).toISOString().split('T')[0]
    return String(raw).substring(0, 10)
  }

  async function handleImportExcel(e) {
    const file = e.target.files[0]
    if (!file) return
    try {
      showToast('⏳ جاري المعالجة...')
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      let targetSheet = workbook.Sheets["Tasks Tracker"] || workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(targetSheet, { defval: '' })

      let updated = 0, added = 0
      for (const row of rows) {
        // البحث عن عنوان المهمة في عدة احتمالات للمسميات
        const title = (row['عنوان المهمة'] || row['Task Description'] || row['Task description'] || row['Task Title'] || '').trim()
        if (!title) continue

        // خرائط ذكية لمصدر المهمة وعنوان المصدر
        const sType = (row['مصدر المهمة'] || row['Task Source'] || row['Channel'] || row['channel'] || row['Source'] || '').trim()
        const sTitle = (row['عنوان المصدر'] || row['Source Title'] || row['Reference'] || row['Task title'] || row['رقم المحضر'] || '').trim()
        const pName = (row['اسم المشروع'] || row['Type'] || row['Project'] || '').trim()
        const owner = (row['المسؤول'] || row['First Owner'] || row['Owner'] || row['Person'] || '').trim()
        const dDate = parseExcelDate(row['تاريخ الاستحقاق'] || row['Due Date'] || row['Due date'])
        
        const completion = String(row['نسبة الإنجاز'] || row['Completion %'] || '')
        const isDone = completion.includes('100') || row['Status'] === 'Completed'

        const taskData = {
          title,
          sourceType: sType,
          sourceTitle: sTitle,
          projectName: pName,
          person: owner,
          dueDate: dDate,
          done: isDone
        }

        const existing = tasks.find(t => t.title.trim().toLowerCase() === title.toLowerCase())
        if (existing) {
          // تحديث فقط الحقول المتوفرة في الإكسل لعدم مسح البيانات القديمة يدوياً
          const updateObj = { done: isDone }
          if (sType) updateObj.sourceType = sType
          if (sTitle) updateObj.sourceTitle = sTitle
          if (pName) updateObj.projectName = pName
          if (owner) updateObj.person = owner
          if (dDate) updateObj.dueDate = dDate
          
          await dbUpdateTask(existing.id, updateObj)
          updated++
        } else {
          await dbAddTask(taskData)
          added++
        }
      }
      showToast(`✅ تم تحديث ${updated} وإضافة ${added} مهمة`)
    } catch (err) { showToast('❌ فشل الاستيراد') }
    e.target.value = ''; setShowExportMenu(false)
  }

  const circumference = 2 * Math.PI * 40
  const menuBtnStyle = { display: 'flex', alignItems: 'center', width: '100%', padding: '10px 12px', background: 'none', border: 'none', color: 'var(--text)', fontSize: 14, cursor: 'pointer', textAlign: 'right', borderRadius: 8 };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div className="header" style={{ paddingBottom: '10px' }}>
        <div className="header-row">
          <div>
            <div className="header-title">مهامي Pro</div>
            <div className="header-sub">{userProfile?.name} • PMO</div>
          </div>
          <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
            <button onClick={() => setShowExportMenu(!showExportMenu)} style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>⬇️</button>
            {showExportMenu && (
              <div style={{ position: 'absolute', top: 38, right: 0, zIndex: 200, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 8, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                <button onClick={exportExcel} style={menuBtnStyle}><span>📗</span> تصدير Excel</button>
                <label style={menuBtnStyle}><span>📥</span> استيراد Excel
                  <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportExcel} />
                </label>
              </div>
            )}
            <button onClick={cycleView} style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--blue-light)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 8, padding: '6px 10px', fontSize: 13, cursor: 'pointer' }}>
              {VIEW_MODES.find(v => v.id === viewMode)?.icon} {VIEW_MODES.find(v => v.id === viewMode)?.label}
            </button>
          </div>
        </div>
      </div>

      <div className="page" style={{ paddingBottom: '90px' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px', gap: 12 }}>
          <div className="ring-container" style={{ width: 70, height: 70 }}>
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="var(--bg3)" strokeWidth="10" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="url(#grad)" strokeWidth="10" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - stats.pct / 100)} strokeLinecap="round" />
              <defs><linearGradient id="grad"><stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#8b5cf6" /></linearGradient></defs>
            </svg>
            <div className="ring-center"><span className="ring-pct">{stats.pct}%</span></div>
          </div>
          <div className="stats-bar" style={{ flex: 1, display: 'flex', justifyContent: 'space-around' }}>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 'bold' }}>{stats.pending}</div><div style={{ fontSize: 10, opacity: 0.6 }}>معلقة</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--red)' }}>{stats.urgent}</div><div style={{ fontSize: 10, opacity: 0.6 }}>عاجل</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--green)' }}>{stats.done}</div><div style={{ fontSize: 10, opacity: 0.6 }}>مكتملة</div></div>
          </div>
        </div>

        <div style={{ padding: '0 16px 12px' }}>
          <input type="search" placeholder="ابحث في المهام..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '10px 15px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', outline: 'none' }} />
        </div>

        <div className="filters" style={{ display: 'flex', gap: 8, padding: '0 16px 12px', overflowX: 'auto' }}>
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', background: filter === f.id ? 'var(--blue)' : 'var(--bg3)', color: filter === f.id ? '#fff' : 'var(--text)', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>{f.label}</button>
          ))}
        </div>

        <div className="task-list" style={{ padding: '0 16px' }}>
          {taskGroups.map(({ task, children }) => (
            <div key={task.id} style={{ marginBottom: 12 }}>
              <TaskCard task={task} onToggle={toggleTask} onEdit={setEditTask} onDelete={id => setDeleteConfirm(id)} showToast={showToast} />
            </div>
          ))}
        </div>

        <button className="fab" onClick={() => setShowForm(true)} style={{ position: 'fixed', bottom: 30, left: 30, width: 56, height: 56, borderRadius: '50%', background: 'var(--blue)', color: '#fff', fontSize: 24, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', cursor: 'pointer', zIndex: 100 }}>+</button>
        <button className="fab" onClick={() => setShowSmartChat(true)} style={{ position: 'fixed', bottom: 100, left: 30, width: 56, height: 56, borderRadius: '50%', background: 'var(--purple)', color: '#fff', fontSize: 24, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', cursor: 'pointer', zIndex: 100 }}>✨</button>
      </div>

      {showForm && <TaskForm onClose={() => setShowForm(false)} onSubmit={addTask} />}
      {editTask && <TaskForm task={editTask} onClose={() => setEditTask(null)} onSubmit={updateTaskHandler} />}
      {showApiKey && <ApiKeyInput apiKey={apiKey} setApiKey={setApiKey} onClose={() => setShowApiKey(false)} />}
      {showSmartChat && <SmartChat apiKey={currentApiKey} onClose={() => setShowSmartChat(false)} onAddTasks={handleSmartChatAdd} showToast={showToast} />}
      
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--card)', padding: 24, borderRadius: 16, width: '90%', maxWidth: 320, textAlign: 'center' }}>
            <p>هل أنت متأكد من حذف هذه المهمة؟</p>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={() => deleteTask(deleteConfirm)} style={{ flex: 1, padding: 10, background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 8 }}>حذف</button>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: 10, background: 'var(--bg3)', color: 'var(--text)', border: 'none', borderRadius: 8 }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
