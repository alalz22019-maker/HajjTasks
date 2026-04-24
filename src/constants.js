/* ─── مهامي Pro — Constants المركزية ─── */

export const TEAM_MEMBERS = [
  'م. علي الزهراني', 'د. منار سمان', 'د. وليد الحسن', 'أ. عبير الشدوخي',
  'د. حامد الزهراني', 'أ. حماد المظيبري', 'أ. محمد القرشي', 'أ. محمد الحجيلي',
  'أ. سعد القرشي', 'أ. أميرة التميمي', 'د. مرام الشهراني',
  'أ. وفاء آل إسماعيل', 'د. سمية الغريب', 'أ. مشاعل المطيري', 'أ. صفاء الشهري',
  'أ. أمجاد المطيري', 'أ. مي الأسمري', 'أ. شادي نبيل',
  'أ. راما القحطاني', 'أ. مها القحطاني', 'د. نجلاء خوجة',
  'أ. مشاعل الغزولي', 'أ. فدوى النفيسي', 'م. حمادي الشعائره',
]

export const SOURCE_TYPES = [
  { value: '', label: '— اختر المصدر —' },
  { value: 'minutes', label: 'محضر' },
  { value: 'directive', label: 'توجيه مباشر' },
  { value: 'email', label: 'إيميل' },
]

export const STATUS_OPTIONS = [
  { value: 'not_started',  label: 'لم يبدأ',      color: '#6b7280' },
  { value: 'in_progress',  label: 'جاري العمل',   color: '#10b981' },
  { value: 'overdue',      label: 'متأخر',        color: '#ef4444' },
  { value: 'completed',    label: 'مكتمل',        color: '#3b82f6' },
]

export const PROJECT_FILES = [
  'إدارة المشاريع',
  'المؤشرات',
  '937 والبلاغات',
  'السموم والمضادات',
  'جاهزية المختبرات',
  'التموين والإمداد',
  'عينتي',
  'التوطين',
  'فحص الزواج',
  'السلامة الحيوية',
  'السياسات والتنظيم',
  'الاتفاقيات والفعاليات',
  'أعمال الحج',
  'أعمال إشرافية',
  'الاتفاقيات والأبحاث',
  'أخرى',
]

export const ROLE_LABEL = { admin: 'مدير', superuser: 'مشرف', user: 'موظف' }
export const ROLE_BG    = { admin: 'rgba(139,92,246,0.15)', superuser: 'rgba(59,130,246,0.15)', user: 'rgba(16,185,129,0.12)' }
export const ROLE_COLOR = { admin: '#a78bfa', superuser: '#60a5fa', user: '#34d399' }

/* Helper: تحويل الحالات القديمة للجديدة */
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
