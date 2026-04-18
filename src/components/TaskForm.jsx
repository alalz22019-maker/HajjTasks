import { useState, useEffect } from 'react'
import { analyzeTaskWithAI } from '../utils/claude'
import { useAuth } from '../contexts/AuthContext'
import { getFirestore, collection, getDocs } from 'firebase/firestore'

const PRIORITIES = [
  { value: 'urgent', label: 'عاجل' },
  { value: 'medium', label: 'متوسطة' },
  { value: 'low', label: 'منخفضة' },
]

const RECURRENCES = [
  { value: '', label: 'لا تكرار' },
  { value: 'daily', label: 'يومي' },
  { value: 'weekly', label: 'أسبوعي' },
  { value: 'biweekly', label: 'كل أسبوعين' },
  { value: 'monthly', label: 'شهري' },
  { value: 'quarterly', label: 'ربع سنوي' },
]

const TASK_TYPES = [
  { value: 'task', label: 'مهمة' },
  { value: 'report', label: 'تقرير' },
  { value: 'meeting', label: 'اجتماع' },
]

const SOURCE_TYPES = [
  { value: '', label: '— اختياري —' },
  { value: 'minutes', label: 'محضر' },
  { value: 'directive', label: 'توجيه مباشر' },
  { value: 'email', label: 'إيميل' },
]

export const STATUS_OPTIONS = [
  { value: 'new',         label: 'جديدة',              color: '#6b7280' },
  { value: 'studying',    label: 'قيد الدراسة',        color: '#8b5cf6' },
  { value: 'in_progress', label: 'قيد التنفيذ',        color: '#3b82f6' },
  { value: 'waiting',     label: 'بانتظار جهة خارجية', color: '#f59e0b' },
  { value: 'review',      label: 'قيد المراجعة',       color: '#06b6d4' },
  { value: 'done',        label: 'مكتملة',             color: '#10b981' },
]

const TEAM_MEMBERS = [
  'م. علي الزهراني', 'د. منار سمان', 'د. وليد الحسن', 'أ. عبير الشدوخي',
  'د. حامد الزهراني', 'أ. حماد المظيبري', 'أ. محمد القرشي', 'أ. محمد الحجيلي',
  'أ. سعد القرشي', 'أ. أميرة التميمي', 'Eksha Mohapatra', 'د. مرام الشهراني',
  'أ. وفاء آل إسماعيل', 'د. سمية الغريب', 'أ. مشاعل المطيري', 'أ. صفاء الشهري',
  'أ. أمجاد المطيري', 'أ. مي الأسمري', 'أ. شادي نبيل'
]

const DEFAULT_TASK = {
  title: '', priority: 'medium', person: '', dueDate: '', recurrence: '',
  reminderTime: '', projectName: '', sourceType: '', sourceTitle: '', done: false,
  taskType: 'task', status: 'new', closeNote: '',
}

export default function TaskForm({ task, onSave, onClose, apiKey, defaultTaskType }) {
  const { isUser, userProfile } = useAuth()
  
  const [form, setForm] = useState(() => {
    if (task) return { ...task, projectName: task.projectName || '', status: task.status || (task.done ? 'done' : 'new') }
    return { ...DEFAULT_TASK, person: isUser ? userProfile?.name : '', taskType: defaultTaskType || 'task' }
  })
  
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiReason, setAiReason] = useState('')
  const [subTasks, setSubTasks] = useState([])
  const [selectedSubTasks, setSelectedSubTasks] = useState([])

  const [existingProjects, setExistingProjects] = useState([])
  const [isNewProject, setIsNewProject] = useState(false)

  useEffect(() => {
    async function fetchProjects() {
      try {
        const db = getFirestore()
        const snap = await getDocs(collection(db, 'tasks'))
        const projectsSet = new Set()
        snap.forEach(doc => {
          const p = doc.data().projectName
          if (p && p.trim() !== '') projectsSet.add(p.trim())
        })
        setExistingProjects(Array.from(projectsSet))
      } catch (e) { console.error('Error fetching projects:', e) }
    }
    fetchProjects()
  }, [])

  function set(field, value) {
    setForm(f => {
      const updated = { ...f, [field]: value }
      if (field === 'status') {
        updated.done = value === 'done'
      }
      return updated
    })
  }

  async function analyzeTask() {
    if (!form.title.trim()) return
    setAnalyzing(true); setAiReason(''); setSubTasks([]); setSelectedSubTasks([])
    try {
      const result = await analyzeTaskWithAI(apiKey, form.title)
      if (result) {
        setForm(f => ({
          ...f, priority: result.priority || f.priority,
          person: isUser ? f.person : (result.person || f.person),
          projectName: result.projectName || f.projectName || '',
        }))
        if (result.reason) setAiReason(result.reason)
        if (Array.isArray(result.subTasks) && result.subTasks.length > 0) {
          setSubTasks(result.subTasks)
          setSelectedSubTasks(result.subTasks)
        }
      }
    } catch (e) { console.error('AI analyze error:', e) } 
    finally { setAnalyzing(false) }
  }

  function toggleSubTask(st) {
    setSelectedSubTasks(prev => prev.includes(st) ? prev.filter(s => s !== st) : [...prev, st])
  }

  function handleSubmit() {
    if (!form.title.trim() || saving) return
    setSaving(true)
    const finalForm = { ...form }
    if (isUser) finalForm.person = userProfile?.name || ''
    finalForm.done = finalForm.status === 'done'
    onSave(finalForm, selectedSubTasks)
  }

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{ 
        alignItems: 'flex-start', 
        paddingTop: 'env(safe-area-inset-top, 60px)',
        paddingBottom: 'env(safe-area-inset-bottom, 20px)'
      }} 
    >
      <div 
        className="modal" 
        onClick={e => e.stopPropagation()}
        style={{ 
          width: '100%', maxWidth: '450px', margin: '0 auto',
          maxHeight: '85vh', overflowY: 'auto',
          boxSizing: 'border-box'
        }}
      >
        <div className="modal-handle" />
        <h2 className="modal-title">{task ? 'تعديل المهمة' : 'إضافة مهمة جديدة'}</h2>

        <div className="form-group">
          <label className="form-label">عنوان المهمة *</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="form-input" style={{ flex: 1 }} value={form.title} onChange={e => set('title', e.target.value)} placeholder="اكتب المهمة..." />
            <button className="ai-analyze-btn" onClick={analyzeTask} disabled={!form.title.trim() || analyzing || !apiKey} title={!apiKey ? 'يلزم إعداد مفتاح API أولاً' : 'تحليل ذكي'}>
              {analyzing ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '✨'}
            </button>
          </div>
        </div>

        {aiReason && (
          <div className="ai-reason-box"><span style={{ fontSize: 13 }}>🤖</span><span>{aiReason}</span></div>
        )}

        <div className="form-group">
          <label className="form-label">الأولوية</label>
          <div className="seg-control">
            {PRIORITIES.map(p => (
              <button key={p.value} className={`seg-btn${form.priority === p.value ? ' active' : ''}`} onClick={() => set('priority', p.value)}>{p.label}</button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">نوع المهمة</label>
          <div className="seg-control">
            {TASK_TYPES.map(t => (
              <button key={t.value} className={`seg-btn${form.taskType === t.value ? ' active' : ''}`} onClick={() => set('taskType', t.value)}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* حالة المهمة المتقدمة */}
        <div className="form-group">
          <label className="form-label">حالة المهمة</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {STATUS_OPTIONS.map(s => (
              <button key={s.value} onClick={() => set('status', s.value)} style={{
                padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                fontFamily: 'inherit', cursor: 'pointer',
                border: form.status === s.value ? `2px solid ${s.color}` : '1px solid var(--border)',
                background: form.status === s.value ? `${s.color}20` : 'var(--bg)',
                color: form.status === s.value ? s.color : 'var(--text2)',
                transition: 'all 0.15s',
              }}>{s.label}</button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">اسم المشروع / المبادرة</label>
          {!isNewProject ? (
            <select className="form-input" value={existingProjects.includes(form.projectName) ? form.projectName : (form.projectName ? 'NEW_PROJECT' : '')}
              onChange={e => {
                if (e.target.value === 'NEW_PROJECT') { setIsNewProject(true); set('projectName', ''); } 
                else { set('projectName', e.target.value) }
              }}>
              <option value="">— بدون مشروع —</option>
              {existingProjects.map(p => <option key={p} value={p}>{p}</option>)}
              {form.projectName && !existingProjects.includes(form.projectName) && form.projectName !== 'NEW_PROJECT' && (<option value={form.projectName}>{form.projectName}</option>)}
              <option value="NEW_PROJECT" style={{ fontWeight: 'bold', color: 'var(--primary)' }}>+ إضافة مشروع/مبادرة جديدة</option>
            </select>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" style={{ flex: 1 }} value={form.projectName} onChange={e => set('projectName', e.target.value)} placeholder="اسم المشروع..." autoFocus />
              <button type="button" onClick={() => { setIsNewProject(false); set('projectName', ''); }} style={{ padding: '0 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', cursor: 'pointer' }}>إلغاء</button>
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">الشخص المسؤول / المتابع</label>
          {isUser ? (
            <input className="form-input" value={userProfile?.name || ''} disabled style={{ background: 'var(--bg3)', cursor: 'not-allowed', opacity: 0.7, color: 'var(--text)' }} />
          ) : (
            <select className="form-input" value={form.person} onChange={e => set('person', e.target.value)}>
              <option value="">— اختر المسؤول —</option>
              {TEAM_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">تاريخ الاستحقاق</label>
            <input className="form-input" type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">وقت التنبيه</label>
            <input className="form-input" type="time" value={form.reminderTime} onChange={e => set('reminderTime', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">التكرار</label>
          <div className="seg-control">
            {RECURRENCES.map(r => (
              <button key={r.value} className={`seg-btn${form.recurrence === r.value ? ' active' : ''}`} onClick={() => set('recurrence', r.value)}>{r.label}</button>
            ))}
          </div>
        </div>

        {subTasks.length > 0 && (
          <div className="subtasks-panel">
            <div className="subtasks-title">📋 المهام الفرعية المقترحة<span className="subtasks-hint">اختر ما تريد إضافته</span></div>
            {subTasks.map(st => (
              <label key={st} className="subtask-item">
                <input type="checkbox" checked={selectedSubTasks.includes(st)} onChange={() => toggleSubTask(st)} className="subtask-checkbox" />
                <span>{st}</span>
              </label>
            ))}
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">مصدر المهمة</label>
            <select className="form-input" value={form.sourceType} onChange={e => set('sourceType', e.target.value)}>
              {SOURCE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">عنوان المصدر</label>
            <input className="form-input" value={form.sourceTitle} onChange={e => set('sourceTitle', e.target.value)} placeholder="رقم المحضر..." disabled={!form.sourceType} />
          </div>
        </div>

        {form.taskType === 'meeting' && (
          <div className="form-group">
            <label className="form-label">وقت الاجتماع</label>
            <input className="form-input" type="time" value={form.meetingTime || ''} onChange={e => set('meetingTime', e.target.value)} />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">ملاحظات الإنجاز</label>
          <textarea className="form-input" value={form.closeNote || ''} onChange={e => set('closeNote', e.target.value)} 
            placeholder="ماذا تم إنجازه..." style={{ minHeight: 60, resize: 'vertical' }} />
        </div>

        <button className="submit-btn" onClick={handleSubmit} disabled={!form.title.trim() || saving}>
          {task ? 'حفظ التغييرات' : selectedSubTasks.length > 0 ? `إضافة المهمة + ${selectedSubTasks.length} مهام فرعية` : 'إضافة المهمة'}
        </button>
        <button className="cancel-btn" onClick={onClose} style={{ marginBottom: '10px' }}>إلغاء</button>
      </div>
    </div>
  )
}
