import { useState, useEffect, useMemo, useRef } from 'react'
import { loadData, saveData } from '../utils/storage'

/* ─── helpers ─────────────────────────────────────────────── */
const TODAY_START = (() => { const d = new Date(); d.setHours(0,0,0,0); return d })()
const TODAY_END   = (() => { const d = new Date(); d.setHours(23,59,59,999); return d })()

function isCompletedToday(t) {
  if (!t.done || !t.completedAt) return false
  const c = new Date(t.completedAt)
  return c >= TODAY_START && c <= TODAY_END
}

function isOverdue(t) {
  if (t.done || !t.dueDate) return false
  return new Date(t.dueDate) < TODAY_START
}

function formatArabicDate(date = new Date()) {
  return date.toLocaleDateString('ar-SA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
}

function formatShortDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })
}

/* ─── Build WhatsApp text ─────────────────────────────────── */
function buildWhatsAppText(tasks) {
  const all     = tasks
  const urgent  = all.filter(t => t.priority === 'urgent' && !t.done)
  const today   = all.filter(isCompletedToday)
  const overdue = all.filter(isOverdue)
  const total   = all.length
  const done    = all.filter(t => t.done).length
  const pct     = total ? Math.round((done / total) * 100) : 0

  const persons = {}
  all.forEach(t => {
    if (!t.person) return
    t.person.split(/[،,]/).map(p => p.trim()).filter(Boolean).forEach(p => {
      if (!persons[p]) persons[p] = { total: 0, done: 0 }
      persons[p].total++
      if (t.done) persons[p].done++
    })
  })

  const sep = '━━━━━━━━━━━━━━━━'
  const lines = []

  lines.push(`📋 *تقرير المهام اليومي*`)
  lines.push(`🗓 ${formatArabicDate()}`)
  lines.push(`👤 علي الزهراني | PMO وزارة الصحة`)
  lines.push(sep)

  lines.push(`📊 *الملخص التنفيذي*`)
  lines.push(`• إجمالي المهام: ${total}`)
  lines.push(`• نسبة الإنجاز: ${pct}%`)
  lines.push(`• عاجلة معلقة: ${urgent.length}`)
  lines.push(`• أنجز اليوم: ${today.length}`)
  if (overdue.length) lines.push(`• متأخرة عن موعدها: ${overdue.length}`)

  if (urgent.length) {
    lines.push(sep)
    lines.push(`🔴 *المهام العاجلة المعلقة* (${urgent.length})`)
    urgent.slice(0, 10).forEach((t, i) => {
      lines.push(`${i + 1}. ${t.title}`)
      if (t.person) lines.push(`   👤 ${t.person}`)
      if (t.dueDate) lines.push(`   📅 ${formatShortDate(t.dueDate)}`)
    })
    if (urgent.length > 10) lines.push(`   ... و${urgent.length - 10} مهام أخرى`)
  }

  if (today.length) {
    lines.push(sep)
    lines.push(`✅ *أنجز اليوم* (${today.length})`)
    today.forEach(t => {
      lines.push(`✓ ${t.title}`)
      if (t.person) lines.push(`  👤 ${t.person}`)
    })
  }

  if (overdue.length) {
    lines.push(sep)
    lines.push(`⚠️ *متأخرة عن موعدها* (${overdue.length})`)
    overdue.slice(0, 5).forEach(t => {
      lines.push(`• ${t.title} — ${formatShortDate(t.dueDate)}`)
    })
  }

  const personEntries = Object.entries(persons).sort((a,b) => b[1].total - a[1].total)
  if (personEntries.length) {
    lines.push(sep)
    lines.push(`👥 *المهام حسب المسؤول*`)
    personEntries.slice(0, 8).forEach(([name, v]) => {
      const filled = Math.round((v.done / v.total) * 5)
      const bar = '▓'.repeat(filled) + '░'.repeat(5 - filled)
      lines.push(`• ${name}: ${v.total} مهمة (${v.done} مكتملة) ${bar}`)
    })
  }

  lines.push(sep)
  lines.push(`_تم إصداره عبر مهامي Pro_`)

  return lines.join('\n')
}

/* ─── StatCard ────────────────────────────────────────────── */
function StatCard({ value, label, color }) {
  return (
    <div className="report-card">
      <div className="report-card-num" style={{
        background: `linear-gradient(135deg, ${color}, ${color}88)`,
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
      }}>{value}</div>
      <div className="report-card-label">{label}</div>
    </div>
  )
}

/* ─── TaskRow ─────────────────────────────────────────────── */
function TaskRow({ t, accent }) {
  return (
    <div style={{
      background: 'var(--card)', borderRadius: 12, padding: '12px 14px',
      marginBottom: 8, borderRight: `3px solid ${accent}`
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{t.title}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--text2)' }}>
        {t.person && <span>👤 {t.person}</span>}
        {t.dueDate && <span>📅 {formatShortDate(t.dueDate)}</span>}
      </div>
    </div>
  )
}

/* ─── PersonRow ───────────────────────────────────────────── */
function PersonRow({ name, total, done }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div style={{
      background: 'var(--card)', borderRadius: 12, padding: '12px 14px', marginBottom: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
    }}>
      <div style={{ fontSize: 14, fontWeight: 500, minWidth: 0, flex: 1,
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        {name}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>{done}/{total}</span>
        <div style={{ width: 60, height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: pct === 100 ? '#10b981' : '#3b82f6', borderRadius: 3
          }} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--text3)', width: 32, textAlign: 'left' }}>{pct}%</span>
      </div>
    </div>
  )
}

/* ─── Main Page ───────────────────────────────────────────── */
export default function ReportsPage({ tasks }) {
  const [tab, setTab] = useState('dashboard')
  const [directorPhone, setDirectorPhone] = useState(() => loadData('mytasks_dir_phone') || '')
  const [notifEnabled, setNotifEnabled] = useState(() => loadData('mytasks_notif') || false)
  const [showSettings, setShowSettings] = useState(false)
  const notifRef = useRef(null)

  const all       = tasks
  const urgent    = useMemo(() => all.filter(t => t.priority === 'urgent' && !t.done), [all])
  const todayDone = useMemo(() => all.filter(isCompletedToday), [all])
  const overdue   = useMemo(() => all.filter(isOverdue), [all])
  const total     = all.length
  const doneCount = all.filter(t => t.done).length
  const pct       = total ? Math.round((doneCount / total) * 100) : 0

  const persons = useMemo(() => {
    const map = {}
    all.forEach(t => {
      if (!t.person) return
      t.person.split(/[،,]/).map(p => p.trim()).filter(Boolean).forEach(p => {
        if (!map[p]) map[p] = { total: 0, done: 0 }
        map[p].total++
        if (t.done) map[p].done++
      })
    })
    return Object.entries(map).sort((a,b) => b[1].total - a[1].total)
  }, [all])

  /* ── 8 AM notification ── */
  useEffect(() => {
    if (!notifEnabled) return
    if (!('Notification' in window)) return

    function schedule() {
      const now  = new Date()
      const next = new Date()
      next.setHours(8, 0, 0, 0)
      if (now >= next) next.setDate(next.getDate() + 1)
      notifRef.current = setTimeout(() => {
        if (Notification.permission === 'granted') {
          new Notification('مهامي Pro — تقرير الصباح ☀️', {
            body: 'تقرير المهام اليومي جاهز للإرسال للمدير',
            icon: '/icons/icon-192x192.png',
            tag: 'daily-report',
          })
        }
        schedule()
      }, next - now)
    }

    if (Notification.permission === 'granted') {
      schedule()
    } else {
      Notification.requestPermission().then(p => {
        if (p === 'granted') schedule()
        else { setNotifEnabled(false); saveData('mytasks_notif', false) }
      })
    }

    return () => clearTimeout(notifRef.current)
  }, [notifEnabled])

  /* ── actions ── */
  function handleNotifToggle() {
    const next = !notifEnabled
    setNotifEnabled(next)
    saveData('mytasks_notif', next)
  }

  function handlePhoneSave(v) {
    setDirectorPhone(v)
    saveData('mytasks_dir_phone', v)
  }

  function shareWhatsApp() {
    const text    = buildWhatsAppText(tasks)
    const encoded = encodeURIComponent(text)
    const phone   = directorPhone.replace(/\D/g, '')
    window.open(phone
      ? `https://wa.me/${phone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`, '_blank')
  }

  function printReport() {
    window.print()
  }

  if (all.length === 0) {
    return (
      <div className="page">
        <div className="header">
          <div className="header-title">📊 التقارير</div>
          <div className="header-sub">لا توجد مهام بعد</div>
        </div>
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <div className="empty-text">لا توجد بيانات</div>
          <div className="empty-sub">أضف مهام لعرض التقارير</div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="header">
        <div className="header-title">📊 التقارير</div>
        <div className="header-sub">{formatArabicDate()}</div>
      </div>

      {/* Tab bar */}
      <div className="report-tab-bar">
        <button
          className={`report-tab${tab === 'dashboard' ? ' active' : ''}`}
          onClick={() => setTab('dashboard')}
        >الإحصائيات</button>
        <button
          className={`report-tab${tab === 'executive' ? ' active' : ''}`}
          onClick={() => setTab('executive')}
        >التقرير التنفيذي</button>
      </div>

      {/* ── Dashboard ── */}
      {tab === 'dashboard' && (
        <div>
          <div className="report-section">
            <div className="report-section-title" style={{ borderColor: '#60a5fa' }}>
              الإجمالي — نسبة الإنجاز {pct}%
            </div>
            <div style={{ background: 'var(--card)', borderRadius: 12, padding: 14, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>التقدم</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{doneCount} / {total}</span>
              </div>
              <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', borderRadius: 4
                }} />
              </div>
            </div>
            <div className="report-row">
              <StatCard value={total} label="الكل" color="#60a5fa" />
              <StatCard value={all.filter(t => !t.done).length} label="معلقة" color="#9090a8" />
              <StatCard value={doneCount} label="مكتملة" color="#10b981" />
              <StatCard value={urgent.length} label="عاجل" color="#ef4444" />
            </div>
          </div>

          <div className="report-section">
            <div className="report-section-title" style={{ borderColor: '#10b981' }}>
              ✅ أنجز اليوم ({todayDone.length})
            </div>
            {todayDone.length === 0
              ? <div style={{ color: 'var(--text3)', fontSize: 13, padding: '8px 4px' }}>لا شيء أنجز اليوم بعد</div>
              : todayDone.map(t => <TaskRow key={t.id} t={t} accent="#10b981" />)
            }
          </div>

          {overdue.length > 0 && (
            <div className="report-section">
              <div className="report-section-title" style={{ borderColor: '#f59e0b' }}>
                ⚠️ متأخرة عن موعدها ({overdue.length})
              </div>
              {overdue.map(t => <TaskRow key={t.id} t={t} accent="#f59e0b" />)}
            </div>
          )}

          {persons.length > 0 && (
            <div className="report-section">
              <div className="report-section-title" style={{ borderColor: '#8b5cf6' }}>
                👥 حسب المسؤول
              </div>
              {persons.map(([name, v]) => (
                <PersonRow key={name} name={name} total={v.total} done={v.done} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Executive Report ── */}
      {tab === 'executive' && (
        <div>
          {/* Action buttons */}
          <div className="exec-actions">
            <button className="exec-btn whatsapp" onClick={shareWhatsApp}>
              <span>📤</span> واتساب
            </button>
            <button className="exec-btn print" onClick={printReport}>
              <span>🖨️</span> PDF
            </button>
          </div>

          {/* Settings */}
          <button className="exec-settings-toggle" onClick={() => setShowSettings(s => !s)}>
            ⚙️ الإعدادات {showSettings ? '▲' : '▼'}
          </button>

          {showSettings && (
            <div className="exec-settings-box">
              <div className="form-group">
                <label className="form-label">رقم واتساب المدير</label>
                <input
                  className="form-input"
                  type="tel"
                  value={directorPhone}
                  onChange={e => handlePhoneSave(e.target.value)}
                  placeholder="966501234567"
                  dir="ltr"
                />
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
                  مع مفتاح الدولة، بدون + أو 00
                </div>
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 0', borderTop: '1px solid var(--border)', marginTop: 4
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>إشعار يومي الساعة 8 صباحاً</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    تنبيه لإرسال التقرير للمدير
                  </div>
                </div>
                <button onClick={handleNotifToggle} style={{
                  width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                  background: notifEnabled ? '#3b82f6' : 'var(--bg3)', transition: 'background 0.2s',
                  flexShrink: 0, position: 'relative'
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 11, background: '#fff',
                    position: 'absolute', top: 3, transition: 'right 0.2s',
                    right: notifEnabled ? 3 : 23, boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                  }} />
                </button>
              </div>
            </div>
          )}

          {/* Executive report card */}
          <div id="exec-report" className="exec-report-card">

            {/* ── Header ── */}
            <div className="exec-report-header">
              <div className="exec-header-top">
                <div className="exec-report-logo">مهامي <span>Pro</span></div>
                <div className="exec-header-badge">التقرير التنفيذي</div>
              </div>
              <div className="exec-report-date">{formatArabicDate()}</div>
              <div className="exec-report-user">علي الزهراني — PMO | وزارة الصحة</div>
              <div className="exec-header-bar" />
            </div>

            {/* ── KPI Strip ── */}
            <div className="exec-kpi-strip">
              <div className="exec-kpi-item">
                <div className="exec-kpi-dot" style={{ background: '#3b82f6' }} />
                <div className="exec-kpi-num" style={{ color: '#1d4ed8' }}>{total}</div>
                <div className="exec-kpi-label">إجمالي</div>
              </div>
              <div className="exec-kpi-item">
                <div className="exec-kpi-dot" style={{ background: '#10b981' }} />
                <div className="exec-kpi-num" style={{ color: '#059669' }}>{pct}%</div>
                <div className="exec-kpi-label">إنجاز</div>
              </div>
              <div className="exec-kpi-item">
                <div className="exec-kpi-dot" style={{ background: '#ef4444' }} />
                <div className="exec-kpi-num" style={{ color: '#dc2626' }}>{urgent.length}</div>
                <div className="exec-kpi-label">عاجلة</div>
              </div>
              <div className="exec-kpi-item">
                <div className="exec-kpi-dot" style={{ background: '#f59e0b' }} />
                <div className="exec-kpi-num" style={{ color: '#d97706' }}>{todayDone.length}</div>
                <div className="exec-kpi-label">أنجز اليوم</div>
              </div>
            </div>

            {/* ── Progress ── */}
            <div className="exec-progress-wrap">
              <div className="exec-progress-label">
                <span>التقدم الكلي</span>
                <span style={{ color: '#059669', fontWeight: 700 }}>{doneCount} / {total} مهمة</span>
              </div>
              <div className="exec-progress-track">
                <div className="exec-progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>

            {/* ── Urgent ── */}
            {urgent.length > 0 && (
              <div className="exec-section">
                <div className="exec-section-head">
                  <div className="exec-section-line" style={{ background: '#ef4444' }} />
                  <div className="exec-section-title" style={{ color: '#dc2626' }}>المهام العاجلة المعلقة</div>
                  <div className="exec-section-badge" style={{ background: '#fee2e2', color: '#991b1b' }}>{urgent.length}</div>
                </div>
                {urgent.map(t => (
                  <div key={t.id} className="exec-task-row">
                    <div className="exec-task-indicator" style={{ background: '#ef4444' }} />
                    <div className="exec-task-body">
                      <div className="exec-task-title">{t.title}</div>
                      <div className="exec-chips">
                        {t.person && <span className="exec-chip exec-chip-person">{t.person}</span>}
                        {t.dueDate && <span className="exec-chip exec-chip-date">{formatShortDate(t.dueDate)}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Overdue ── */}
            {overdue.length > 0 && (
              <div className="exec-section">
                <div className="exec-section-head">
                  <div className="exec-section-line" style={{ background: '#f59e0b' }} />
                  <div className="exec-section-title" style={{ color: '#b45309' }}>متأخرة عن الموعد</div>
                  <div className="exec-section-badge" style={{ background: '#fef3c7', color: '#92400e' }}>{overdue.length}</div>
                </div>
                {overdue.map(t => (
                  <div key={t.id} className="exec-task-row">
                    <div className="exec-task-indicator" style={{ background: '#f59e0b' }} />
                    <div className="exec-task-body">
                      <div className="exec-task-title">{t.title}</div>
                      <div className="exec-chips">
                        {t.person && <span className="exec-chip exec-chip-person">{t.person}</span>}
                        {t.dueDate && <span className="exec-chip exec-chip-date late">{formatShortDate(t.dueDate)}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Completed Today ── */}
            {todayDone.length > 0 && (
              <div className="exec-section">
                <div className="exec-section-head">
                  <div className="exec-section-line" style={{ background: '#10b981' }} />
                  <div className="exec-section-title" style={{ color: '#059669' }}>أنجز اليوم</div>
                  <div className="exec-section-badge" style={{ background: '#d1fae5', color: '#065f46' }}>{todayDone.length}</div>
                </div>
                {todayDone.map(t => (
                  <div key={t.id} className="exec-task-row">
                    <div className="exec-task-indicator" style={{ background: '#10b981' }} />
                    <div className="exec-task-body">
                      <div className="exec-task-title done">{t.title}</div>
                      <div className="exec-chips">
                        {t.person && <span className="exec-chip exec-chip-person">{t.person}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── By Person ── */}
            {persons.length > 0 && (
              <div className="exec-section">
                <div className="exec-section-head">
                  <div className="exec-section-line" style={{ background: '#6366f1' }} />
                  <div className="exec-section-title" style={{ color: '#4338ca' }}>الأداء حسب المسؤول</div>
                </div>
                {persons.map(([name, v]) => {
                  const p = v.total ? Math.round((v.done / v.total) * 100) : 0
                  return (
                    <div key={name} className="exec-person-row">
                      <div className="exec-person-name">{name}</div>
                      <div className="exec-person-bar-wrap">
                        <div className="exec-person-count">{v.done}/{v.total}</div>
                        <div className="exec-person-track">
                          <div className="exec-person-fill" style={{
                            width: `${p}%`,
                            background: p === 100 ? '#10b981' : '#6366f1'
                          }} />
                        </div>
                        <div className="exec-person-pct">{p}%</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Footer ── */}
            <div className="exec-report-footer">
              <div className="exec-foot-brand">مهامي Pro</div>
              <div className="exec-foot-time">
                {new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })} • {formatArabicDate()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
