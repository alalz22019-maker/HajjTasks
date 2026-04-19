import { useState, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import PullToRefresh from '../components/PullToRefresh'

/* ─── الـ 33 تقرير دوري ─────────────────────────────────── */
const BUSINESS_REPORTS = [
  // أسبوعي (10)
  { id: 'r1',  name: 'مؤشر TAT ER',           freq: 'weekly',    owner: 'أ. حماد المظيبري' },
  { id: 'r2',  name: 'المخزون',                freq: 'weekly',    owner: 'أ. سعد القرشي' },
  { id: 'r3',  name: 'إرادة',                  freq: 'weekly',    owner: 'أ. محمد القرشي' },
  { id: 'r4',  name: 'التحديات',               freq: 'weekly',    owner: 'أ. شادي نبيل' },
  { id: 'r5',  name: 'كوفيد / وقاية',          freq: 'weekly',    owner: 'أ. وفاء آل إسماعيل' },
  { id: 'r6',  name: 'PHC',                    freq: 'weekly',    owner: 'أ. أميرة التميمي' },
  { id: 'r7',  name: 'مستعد',                  freq: 'weekly',    owner: 'أ. محمد الحجيلي' },
  { id: 'r8',  name: '937',                    freq: 'weekly',    owner: 'أ. عبير الشدوخي' },
  { id: 'r9',  name: 'التذاكر',                freq: 'weekly',    owner: 'أ. عبير الشدوخي' },
  { id: 'r10', name: 'المؤشرات والمشاريع',     freq: 'weekly',    owner: 'م. علي الزهراني' },
  // شهري (5)
  { id: 'r11', name: 'إحصائيات الفحوصات',      freq: 'monthly',   owner: 'أ. مها القحطاني' },
  { id: 'r12', name: 'STD-HIV',                freq: 'monthly',   owner: 'د. نجلاء خوجة' },
  { id: 'r13', name: 'الزيارات الإشرافية',      freq: 'monthly',   owner: 'أ. محمد القرشي' },
  { id: 'r14', name: 'أداء',                   freq: 'monthly',   owner: 'أ. حماد المظيبري' },
  { id: 'r15', name: 'فحص الزواج',             freq: 'monthly',   owner: 'أ. راما القحطاني' },
  // ربعي (10)
  { id: 'r16', name: 'الحد الجنوبي',            freq: 'quarterly', owner: 'أ. محمد الحجيلي' },
  { id: 'r17', name: 'العينات للخارج',          freq: 'quarterly', owner: 'أ. فدوى النفيسي' },
  { id: 'r18', name: 'EMT/TDM',               freq: 'quarterly', owner: 'د. حامد الزهراني' },
  { id: 'r19', name: 'السحايا',                freq: 'quarterly', owner: 'د. حامد الزهراني' },
  { id: 'r20', name: 'AMR',                   freq: 'quarterly', owner: 'د. نجلاء خوجة' },
  { id: 'r21', name: 'المؤشرات الربعية',        freq: 'quarterly', owner: 'م. علي الزهراني' },
  { id: 'r22', name: 'الفحص الاستكشافي',       freq: 'quarterly', owner: 'أ. مشاعل الغزولي' },
  { id: 'r23', name: 'وازن',                   freq: 'quarterly', owner: 'م. علي الزهراني' },
  { id: 'r24', name: 'إمداد',                  freq: 'quarterly', owner: 'أ. سعد القرشي' },
  { id: 'r25', name: 'تجربة المستفيد',          freq: 'quarterly', owner: 'أ. أميرة التميمي' },
  // سنوي (4)
  { id: 'r26', name: 'التسمم الغذائي',          freq: 'yearly',    owner: 'د. حامد الزهراني' },
  { id: 'r27', name: 'الأمراض التنفسية',        freq: 'yearly',    owner: 'د. سمية الغريب' },
  { id: 'r28', name: 'حمى الضنك',              freq: 'yearly',    owner: 'د. سمية الغريب' },
  { id: 'r29', name: 'الإنجازات السنوية',       freq: 'yearly',    owner: 'م. علي الزهراني' },
  { id: 'r30', name: 'الأحداث الجسيمة',         freq: 'yearly',    owner: 'أ. شادي نبيل' },
  { id: 'r31', name: 'المخاطر',                freq: 'yearly',    owner: 'أ. شادي نبيل' },
  { id: 'r32', name: 'السلامة الحيوية',         freq: 'yearly',    owner: 'أ. مشاعل المطيري' },
  { id: 'r33', name: 'التوطين',                freq: 'yearly',    owner: 'أ. محمد الحجيلي' },
]

const FREQ_LABEL = { weekly: 'أسبوعي', monthly: 'شهري', quarterly: 'ربعي', yearly: 'سنوي' }
const FREQ_COLOR = { weekly: '#3b82f6', monthly: '#8b5cf6', quarterly: '#f59e0b', yearly: '#10b981' }
const FREQ_ICON  = { weekly: '📅', monthly: '📆', quarterly: '📊', yearly: '📋' }

const FREQ_TABS = [
  { id: 'all',       label: 'الكل',    icon: '📋' },
  { id: 'weekly',    label: 'أسبوعي',  icon: '📅' },
  { id: 'monthly',   label: 'شهري',    icon: '📆' },
  { id: 'quarterly', label: 'ربعي',    icon: '📊' },
  { id: 'yearly',    label: 'سنوي',    icon: '🗓' },
]

/* ─── Date helpers ─────────────────────────────── */
function getNextDueDate(freq) {
  const now = new Date()
  const d = new Date(now)
  
  switch (freq) {
    case 'weekly': {
      // الأحد القادم
      const day = d.getDay()
      const daysUntilSunday = day === 0 ? 7 : 7 - day
      d.setDate(d.getDate() + daysUntilSunday)
      break
    }
    case 'monthly': {
      // أول يوم بالشهر الجاي
      d.setMonth(d.getMonth() + 1, 1)
      break
    }
    case 'quarterly': {
      // أول يوم بالربع الجاي
      const currentQ = Math.floor(d.getMonth() / 3)
      d.setMonth((currentQ + 1) * 3, 1)
      break
    }
    case 'yearly': {
      // أول يناير الجاي
      d.setFullYear(d.getFullYear() + 1, 0, 1)
      break
    }
    default: break
  }
  d.setHours(0, 0, 0, 0)
  return d
}

function getDaysUntil(date) {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const diff = Math.ceil((date - now) / (1000 * 60 * 60 * 24))
  return diff
}

function formatDateAr(date) {
  return date.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })
}

function getUrgencyLevel(daysUntil) {
  if (daysUntil < 0) return 'overdue'
  if (daysUntil <= 2) return 'urgent'
  if (daysUntil <= 7) return 'soon'
  return 'normal'
}

const URGENCY_STYLE = {
  overdue: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', color: '#ef4444', label: 'متأخر' },
  urgent:  { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', color: '#f59e0b', label: 'قريب جداً' },
  soon:    { bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.2)',  color: '#3b82f6', label: 'هذا الأسبوع' },
  normal:  { bg: 'var(--card)',            border: 'var(--border)',         color: 'var(--text2)', label: '' },
}

/* ─── Check if report matches a task (delivered) ─────── */
function findMatchingTask(report, tasks) {
  const rName = report.name.toLowerCase()
  return tasks.find(t => {
    if (t.taskType !== 'report' && !isReportLike(t)) return false
    const tTitle = (t.title || '').toLowerCase()
    return tTitle.includes(rName) || rName.includes(tTitle.substring(0, 8))
  })
}

function isReportLike(t) {
  const title = (t.title || '').toLowerCase()
  return ['تقرير', 'report', 'إحصائية', 'مؤشر'].some(k => title.includes(k))
}

/* ─── Component ────────────────────────────────── */
export default function BusinessReportsPage({ tasks, showToast }) {
  const { userProfile, isAdmin } = useAuth()
  const userName = userProfile?.name || ''
  const [activeFreq, setActiveFreq] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Enrich reports with due dates and status
  const enrichedReports = useMemo(() => {
    return BUSINESS_REPORTS.map(r => {
      const nextDue = getNextDueDate(r.freq)
      const daysUntil = getDaysUntil(nextDue)
      const urgency = getUrgencyLevel(daysUntil)
      const matchedTask = findMatchingTask(r, tasks)
      const isDelivered = matchedTask?.done || false

      return { ...r, nextDue, daysUntil, urgency, matchedTask, isDelivered }
    })
  }, [tasks])

  // Filter
  const filtered = useMemo(() => {
    let list = enrichedReports
    if (activeFreq !== 'all') list = list.filter(r => r.freq === activeFreq)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(r => 
        r.name.toLowerCase().includes(q) || 
        r.owner.toLowerCase().includes(q)
      )
    }
    // Sort: overdue first, then by days until
    return list.sort((a, b) => a.daysUntil - b.daysUntil)
  }, [enrichedReports, activeFreq, searchQuery])

  // Stats
  const stats = useMemo(() => {
    const total = enrichedReports.length
    const overdue = enrichedReports.filter(r => r.urgency === 'overdue').length
    const urgent = enrichedReports.filter(r => r.urgency === 'urgent').length
    const delivered = enrichedReports.filter(r => r.isDelivered).length
    const byFreq = {
      weekly: enrichedReports.filter(r => r.freq === 'weekly').length,
      monthly: enrichedReports.filter(r => r.freq === 'monthly').length,
      quarterly: enrichedReports.filter(r => r.freq === 'quarterly').length,
      yearly: enrichedReports.filter(r => r.freq === 'yearly').length,
    }
    return { total, overdue, urgent, delivered, byFreq }
  }, [enrichedReports])

  // Group by owner for admin view
  const byOwner = useMemo(() => {
    const map = {}
    enrichedReports.forEach(r => {
      if (!map[r.owner]) map[r.owner] = { total: 0, overdue: 0, delivered: 0 }
      map[r.owner].total++
      if (r.urgency === 'overdue') map[r.owner].overdue++
      if (r.isDelivered) map[r.owner].delivered++
    })
    return Object.entries(map).sort((a, b) => b[1].overdue - a[1].overdue)
  }, [enrichedReports])

  return (
    <PullToRefresh onRefresh={() => showToast('✓ محدّث')}>
      <div className="header">
        <div className="header-row">
          <div>
            <div className="header-title">📋 تقارير الأعمال</div>
            <div className="header-sub">{stats.total} تقرير دوري • PMO مركز عمليات المختبرات</div>
          </div>
        </div>
      </div>

      <div className="page" style={{ paddingBottom: 90 }}>
        {/* Quick Stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
          padding: '12px 16px',
        }}>
          <div style={{
            background: 'var(--card)', borderRadius: 12, padding: '10px 6px',
            textAlign: 'center', border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{stats.total}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>إجمالي</div>
          </div>
          <div style={{
            background: stats.overdue > 0 ? 'rgba(239,68,68,0.08)' : 'var(--card)', borderRadius: 12, padding: '10px 6px',
            textAlign: 'center', border: `1px solid ${stats.overdue > 0 ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#ef4444' }}>{stats.overdue}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>متأخر</div>
          </div>
          <div style={{
            background: 'var(--card)', borderRadius: 12, padding: '10px 6px',
            textAlign: 'center', border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b' }}>{stats.urgent}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>قريب</div>
          </div>
          <div style={{
            background: 'var(--card)', borderRadius: 12, padding: '10px 6px',
            textAlign: 'center', border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>{stats.delivered}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>مُسلّم</div>
          </div>
        </div>

        {/* Frequency Tabs */}
        <div style={{
          display: 'flex', gap: 6, padding: '0 16px 10px',
          overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        }}>
          {FREQ_TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveFreq(tab.id)} style={{
              padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              whiteSpace: 'nowrap', fontFamily: 'var(--font)', border: 'none',
              background: activeFreq === tab.id ? 'linear-gradient(135deg,#3b82f6,#8b5cf6)' : 'var(--bg3)',
              color: activeFreq === tab.id ? '#fff' : 'var(--text2)',
              transition: 'all 0.2s', cursor: 'pointer',
            }}>
              {tab.icon} {tab.label}
              {tab.id !== 'all' && (
                <span style={{ marginRight: 4, fontSize: 10, opacity: 0.8 }}>
                  ({stats.byFreq[tab.id] || 0})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ padding: '0 16px 10px', position: 'relative' }}>
          <span style={{ position: 'absolute', right: 28, top: '50%', transform: 'translateY(-50%)', fontSize: 15, opacity: 0.45 }}>🔍</span>
          <input type="search" placeholder="ابحث بالاسم أو المسؤول..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '9px 38px 9px 12px', borderRadius: 12,
              border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14, outline: 'none',
            }}
          />
        </div>

        {/* Reports List */}
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text3)', fontSize: 13 }}>
              📋 لا توجد تقارير بهذا الفلتر
            </div>
          ) : filtered.map(r => {
            const urg = URGENCY_STYLE[r.urgency]
            const isMyReport = userName && r.owner.includes(userName.split(' ').pop())
            return (
              <div key={r.id} style={{
                padding: '12px 14px', borderRadius: 14,
                background: urg.bg,
                border: `1px solid ${urg.border}`,
                borderRight: `4px solid ${FREQ_COLOR[r.freq]}`,
                opacity: r.isDelivered ? 0.6 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 700, color: 'var(--text)',
                      textDecoration: r.isDelivered ? 'line-through' : 'none',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      {r.isDelivered && <span>✅</span>}
                      {r.name}
                      {isMyReport && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>أنت</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span>👤 {r.owner.split(' ').slice(-1)[0]}</span>
                      <span style={{ color: FREQ_COLOR[r.freq] }}>
                        {FREQ_ICON[r.freq]} {FREQ_LABEL[r.freq]}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'left', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: urg.color, fontWeight: 700 }}>
                      {r.daysUntil < 0
                        ? `متأخر ${Math.abs(r.daysUntil)} يوم`
                        : r.daysUntil === 0
                        ? 'اليوم!'
                        : r.daysUntil === 1
                        ? 'بكرا'
                        : `${r.daysUntil} يوم`
                      }
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                      📅 {formatDateAr(r.nextDue)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Owner Summary (Admin only) */}
        {isAdmin && (
          <div style={{ padding: '0 16px', marginBottom: 20 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 0', marginBottom: 8,
            }}>
              <span style={{ fontSize: 16 }}>👥</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>متابعة حسب المسؤول</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {byOwner.map(([owner, data]) => (
                <div key={owner} style={{
                  padding: '10px 14px', borderRadius: 12,
                  background: data.overdue > 0 ? 'rgba(239,68,68,0.06)' : 'var(--card)',
                  border: `1px solid ${data.overdue > 0 ? 'rgba(239,68,68,0.15)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      {owner}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                      {data.total} تقرير
                      {data.delivered > 0 && <span style={{ color: '#10b981' }}> • {data.delivered} مُسلّم</span>}
                    </div>
                  </div>
                  {data.overdue > 0 && (
                    <span style={{
                      padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                      background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                    }}>
                      {data.overdue} متأخر
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PullToRefresh>
  )
}
