/* ─── أعمال الحج — Constants ─── */

export const TEAM_MEMBERS = [
  'م. علي الزهراني', 'د. منار سمان', 'د. وليد الحسن',
  'أ. محمد القرشي', 'أ. محمد الحجيلي', 'أ. سعد القرشي', 'م. حمادي الشعائره',
]

export const SOURCE_TYPES = [
  { value: '', label: '— اختر المصدر —' },
  { value: 'minutes', label: 'محضر' },
  { value: 'directive', label: 'توجيه مباشر' },
  { value: 'email', label: 'إيميل' },
  { value: 'routine', label: 'مهمة روتينية' },
]

export const STATUS_OPTIONS = [
  { value: 'not_started',  label: 'لم يبدأ',      color: '#6b7280' },
  { value: 'in_progress',  label: 'جاري العمل',   color: '#10b981' },
  { value: 'overdue',      label: 'متأخر',        color: '#ef4444' },
  { value: 'completed',    label: 'مكتمل',        color: '#3b82f6' },
]

export const PROJECT_FILES = [
  'مسار التدريب',
  'مسار الفرضيات',
  'مسار جمع البيانات',
  'مسار التقارير الدورية',
  'مسار تقرير الزيارات الاشرافية',
  'مسار التذاكر',
  'مسار جاهزية الكوادر الصحية',
]

export const PRIORITIES = [
  { value: 'urgent', label: 'عاجل' },
  { value: 'medium', label: 'متوسطة' },
  { value: 'low',    label: 'منخفضة' },
]

export const TASK_TYPES = [
  { value: 'task',    label: 'مهمة' },
  { value: 'meeting', label: 'اجتماع' },
]

export const DEFAULT_REPORT_TYPES = [
  { value: 'periodic', label: 'التقرير الدوري' },
  { value: 'supervisory_visit', label: 'تقرير الزيارات الإشرافية' },
]

/* Helper: حساب الحالة الفعلية */
export function getEffectiveStatus(task) {
  if (task.status === 'completed' || task.done) return 'completed'
  if (task.dueDate && task.status !== 'completed') {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const due = new Date(task.dueDate); due.setHours(0, 0, 0, 0)
    if (due < today) return 'overdue'
  }
  return task.status || 'not_started'
}

export function getStatusInfo(status) {
  return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0]
}

export function migrateStatus(oldStatus, dueDate, done) {
  if (done || oldStatus === 'done' || oldStatus === 'completed') return 'completed'
  if (dueDate) {
    const due = new Date(dueDate)
    due.setHours(23, 59, 59, 999)
    if (due < new Date()) return 'overdue'
  }
  if (oldStatus === 'in_progress' || oldStatus === 'studying' ||
      oldStatus === 'executing' || oldStatus === 'review' ||
      oldStatus === 'waiting') return 'in_progress'
  return 'not_started'
}

export const RECURRENCES = [
  { value: '',          label: 'لا تكرار' },
  { value: 'daily',     label: 'يومي' },
  { value: 'weekly',    label: 'أسبوعي' },
  { value: 'biweekly',  label: 'كل أسبوعين' },
  { value: 'monthly',   label: 'شهري' },
]

export const ROLE_LABEL = { admin: 'مدير', superuser: 'مشرف', user: 'موظف' }
export const ROLE_BG    = { admin: 'rgba(139,92,246,0.15)', superuser: 'rgba(59,130,246,0.15)', user: 'rgba(16,185,129,0.12)' }
export const ROLE_COLOR = { admin: '#a78bfa', superuser: '#60a5fa', user: '#34d399' }
