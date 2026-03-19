import { useState } from 'react'

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

const DEFAULT_TASK = {
  title: '',
  priority: 'medium',
  category: 'work',
  subcategory: 'other',
  person: '',
  dueDate: '',
  recurrence: '',
  reminderTime: '',
  done: false,
}

export default function TaskForm({ task, onSave, onClose }) {
  const [form, setForm] = useState(task ? { ...task } : { ...DEFAULT_TASK })

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

  function handleSubmit() {
    if (!form.title.trim()) return
    onSave(form)
  }

  const subs = SUBCATEGORIES[form.category] || []

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <h2 className="modal-title">{task ? 'تعديل المهمة' : 'إضافة مهمة جديدة'}</h2>

        <div className="form-group">
          <label className="form-label">عنوان المهمة *</label>
          <input
            className="form-input"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="اكتب المهمة..."
          />
        </div>

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

        <button className="submit-btn" onClick={handleSubmit} disabled={!form.title.trim()}>
          {task ? 'حفظ التغييرات' : 'إضافة المهمة'}
        </button>
        <button className="cancel-btn" onClick={onClose}>إلغاء</button>
      </div>
    </div>
  )
}
