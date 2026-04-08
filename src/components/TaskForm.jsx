import { useState } from 'react'
import { analyzeTaskWithAI } from '../utils/claude'

const PRIORITIES = [
  { value: 'urgent', label: 'عاجل' },
  { value: 'medium', label: 'متوسطة' },
  { value: 'low', label: 'منخفضة' },
]

const CATEGORIES = [
  { value: 'work', label: 'عمل' },
  { value: 'personal', label: 'شخصي' },
  { value: 'health', label: 'صحة' },
]

const SUBCATEGORIES = {
  work: [
    { value: 'leaders', label: 'القادة' },
    { value: 'team', label: 'الفريق' },
    { value: 'other', label: 'أخرى' },
  ],
  personal: [
    { value: 'home', label: 'البيت' },
    { value: 'business', label: 'بيزنس' },
    { value: 'other', label: 'أخرى' },
  ],
  health: [
    { value: 'other', label: 'أخرى' },
  ],
}

const RECURRENCES = [
  { value: '', label: 'لا تكرار' },
  { value: 'daily', label: 'يومي' },
  { value: 'weekly', label: 'أسبوعي' },
  { value: 'monthly', label: 'شهري' },
]

const SOURCE_TYPES = [
  { value: '', label: '— اختياري —' },
  { value: 'minutes', label: 'محضر' },
  { value: 'directive', label: 'توجيه مباشر' },
  { value: 'email', label: 'إيميل' },
]

const DEFAULT_TASK = {
  title: '',
  priority: 'medium',
  category: 'work',
  subcategory: 'other',
  person: '',
  dueDate: '',
  recurrence: '',
  reminderTime: '',
  projectName: '',
  sourceType: '',
  sourceTitle: '',
  done: false,
}

export default function TaskForm({ task, onSave, onClose, apiKey }) {
  const [form, setForm] = useState(task ? { ...task, projectName: task.projectName || '' } : { ...DEFAULT_TASK })
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiReason, setAiReason] = useState('')
  const [subTasks, setSubTasks] = useState([])
  const [selectedSubTasks, setSelectedSubTasks] = useState([])

  function set(field, value) {
    setForm(f => {
      const next = { ...f, [field]: value }
      if (field === 'category') {
        const subs = SUBCATEGORIES[value]
        next.subcategory = subs?.[0]?.value || 'other'
      }
      return next
    })
  }

  async function analyzeTask() {
    if (!form.title.trim()) return
    setAnalyzing(true)
    setAiReason('')
    setSubTasks([])
    setSelectedSubTasks([])
    try {
      const result = await analyzeTaskWithAI(apiKey, form.title)
      if (result) {
        setForm(f => ({
          ...f,
          priority: result.priority || f.priority,
          category: result.category || f.category,
          subcategory: result.subcategory || f.subcategory,
          person: result.person || f.person,
          projectName: result.projectName || f.projectName || '',
        }))
        if (result.reason) setAiReason(result.reason)
        if (Array.isArray(result.subTasks) && result.subTasks.length > 0) {
          setSubTasks(result.subTasks)
          setSelectedSubTasks(result.subTasks)
        }
      }
    } catch (e) {
      console.error('AI analyze error:', e)
    } finally {
      setAnalyzing(false)
    }
  }

  function toggleSubTask(st) {
    setSelectedSubTasks(prev =>
      prev.includes(st) ? prev.filter(s => s !== st) : [...prev, st]
    )
  }

  function handleSubmit() {
    if (!form.title.trim() || saving) return
    setSaving(true)
    onSave(form, selectedSubTasks)
  }

  const subs = SUBCATEGORIES[form.category] || []

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <h2 className="modal-title">{task ? 'تعديل المهمة' : 'إضافة مهمة جديدة'}</h2>

        <div className="form-group">
          <label className="form-label">عنوان المهمة *</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-input"
              style={{ flex: 1 }}
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="اكتب المهمة..."
            />
            <button
              className="ai-analyze-btn"
              onClick={analyzeTask}
              disabled={!form.title.trim() || analyzing || !apiKey}
              title={!apiKey ? 'يلزم إعداد مفتاح API أولاً' : 'تحليل ذكي'}
            >
              {analyzing ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '✨'}
            </button>
          </div>
          {!apiKey && (
            <div style={{ fontSize: 11, color: 'var(--orange)', marginTop: 4 }}>
              أضف مفتاح API لتفعيل التحليل الذكي
            </div>
          )}
        </div>

        {aiReason && (
          <div className="ai-reason-box">
            <span style={{ fontSize: 13 }}>🤖</span>
            <span>{aiReason}</span>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">الأولوية</label>
          <div className="seg-control">
            {PRIORITIES.map(p => (
              <button
                key={p.value}
                className={`seg-btn${form.priority === p.value ? ' active' : ''}`}
                onClick={() => set('priority', p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">التصنيف</label>
            <select
              className="form-input"
              value={form.category}
              onChange={e => set('category', e.target.value)}
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">التصنيف الفرعي</label>
            <select
              className="form-input"
              value={form.subcategory}
              onChange={e => set('subcategory', e.target.value)}
            >
              {subs.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">اسم المشروع / المبادرة</label>
          <input
            className="form-input"
            value={form.projectName}
            onChange={e => set('projectName', e.target.value)}
            placeholder="مثال: مشروع التحول الرقمي..."
          />
        </div>

        <div className="form-group">
          <label className="form-label">الشخص المسؤول / المتابع</label>
          <input
            className="form-input"
            value={form.person}
            onChange={e => set('person', e.target.value)}
            placeholder="اسم الشخص..."
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">تاريخ الاستحقاق</label>
            <input
              className="form-input"
              type="date"
              value={form.dueDate}
              onChange={e => set('dueDate', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">وقت التنبيه</label>
            <input
              className="form-input"
              type="time"
              value={form.reminderTime}
              onChange={e => set('reminderTime', e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">التكرار</label>
          <div className="seg-control">
            {RECURRENCES.map(r => (
              <button
                key={r.value}
                className={`seg-btn${form.recurrence === r.value ? ' active' : ''}`}
                onClick={() => set('recurrence', r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {subTasks.length > 0 && (
          <div className="subtasks-panel">
            <div className="subtasks-title">
              📋 المهام الفرعية المقترحة
              <span className="subtasks-hint">اختر ما تريد إضافته</span>
            </div>
            {subTasks.map(st => (
              <label key={st} className="subtask-item">
                <input
                  type="checkbox"
                  checked={selectedSubTasks.includes(st)}
                  onChange={() => toggleSubTask(st)}
                  className="subtask-checkbox"
                />
                <span>{st}</span>
              </label>
            ))}
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">مصدر المهمة</label>
            <select
              className="form-input"
              value={form.sourceType}
              onChange={e => set('sourceType', e.target.value)}
            >
              {SOURCE_TYPES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">عنوان المصدر</label>
            <input
              className="form-input"
              value={form.sourceTitle}
              onChange={e => set('sourceTitle', e.target.value)}
              placeholder="رقم المحضر أو الإيميل..."
              disabled={!form.sourceType}
            />
          </div>
        </div>

        <button className="submit-btn" onClick={handleSubmit} disabled={!form.title.trim() || saving}>
          {task
            ? 'حفظ التغييرات'
            : selectedSubTasks.length > 0
              ? `إضافة المهمة + ${selectedSubTasks.length} مهام فرعية`
              : 'إضافة المهمة'}
        </button>
        <button className="cancel-btn" onClick={onClose}>إلغاء</button>
      </div>
    </div>
  )
}
