import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { TEAM_MEMBERS } from '../constants'
import PullToRefresh from '../components/PullToRefresh'
import {
  addBusinessReport, updateBusinessReport, deleteBusinessReport,
  subscribeToBusinessReports, recordReportDelivery,
} from '../utils/db'

/* ─── Seed data ──────────────────────────────────────── */
const SEED_REPORTS = [
  { name: 'مؤشر TAT ER',       freq: 'weekly',    owner: 'أ. حماد المظيبري', target: 'المدير التنفيذي' },
  { name: 'المخزون',            freq: 'weekly',    owner: 'أ. سعد القرشي',    target: 'المدير التنفيذي' },
  { name: 'إرادة',              freq: 'weekly',    owner: 'أ. محمد القرشي',   target: 'المدير التنفيذي' },
  { name: 'التحديات',           freq: 'weekly',    owner: 'أ. شادي نبيل',     target: 'المدير التنفيذي' },
  { name: 'كوفيد / وقاية',      freq: 'weekly',    owner: 'أ. وفاء آل إسماعيل', target: 'المدير التنفيذي' },
  { name: 'PHC',                freq: 'weekly',    owner: 'أ. أميرة التميمي',  target: 'المدير التنفيذي' },
  { name: 'مستعد',              freq: 'weekly',    owner: 'أ. محمد الحجيلي',   target: 'المدير التنفيذي' },
  { name: '937',                freq: 'weekly',    owner: 'أ. عبير الشدوخي',   target: 'المدير التنفيذي' },
  { name: 'التذاكر',            freq: 'weekly',    owner: 'أ. عبير الشدوخي',   target: 'المدير التنفيذي' },
  { name: 'المؤشرات والمشاريع', freq: 'weekly',    owner: 'م. علي الزهراني',   target: 'المدير التنفيذي' },
  { name: 'إحصائيات الفحوصات',  freq: 'monthly',   owner: 'أ. مها القحطاني',   target: 'الإدارة' },
  { name: 'STD-HIV',            freq: 'monthly',   owner: 'د. نجلاء خوجة',     target: 'الإدارة' },
  { name: 'الزيارات الإشرافية',  freq: 'monthly',   owner: 'أ. محمد القرشي',    target: 'الإدارة' },
  { name: 'أداء',               freq: 'monthly',   owner: 'أ. حماد المظيبري',  target: 'الإدارة' },
  { name: 'فحص الزواج',         freq: 'monthly',   owner: 'أ. راما القحطاني',   target: 'الإدارة' },
  { name: 'الحد الجنوبي',        freq: 'quarterly', owner: 'أ. محمد الحجيلي',    target: 'الوزارة' },
  { name: 'العينات للخارج',      freq: 'quarterly', owner: 'أ. فدوى النفيسي',    target: 'الوزارة' },
  { name: 'EMT/TDM',           freq: 'quarterly', owner: 'د. حامد الزهراني',   target: 'الوزارة' },
  { name: 'السحايا',            freq: 'quarterly', owner: 'د. حامد الزهراني',   target: 'الوزارة' },
  { name: 'AMR',               freq: 'quarterly', owner: 'د. نجلاء خوجة',      target: 'الوزارة' },
  { name: 'المؤشرات الربعية',    freq: 'quarterly', owner: 'م. علي الزهراني',    target: 'الوزارة' },
  { name: 'الفحص الاستكشافي',   freq: 'quarterly', owner: 'أ. مشاعل الغزولي',   target: 'الوزارة' },
  { name: 'وازن',               freq: 'quarterly', owner: 'م. علي الزهراني',    target: 'الوزارة' },
  { name: 'إمداد',              freq: 'quarterly', owner: 'أ. سعد القرشي',      target: 'الوزارة' },
  { name: 'تجربة المستفيد',      freq: 'quarterly', owner: 'أ. أميرة التميمي',   target: 'الوزارة' },
  { name: 'التسمم الغذائي',      freq: 'yearly',    owner: 'د. حامد الزهراني',   target: 'الوزارة' },
  { name: 'الأمراض التنفسية',    freq: 'yearly',    owner: 'د. سمية الغريب',     target: 'الوزارة' },
  { name: 'حمى الضنك',          freq: 'yearly',    owner: 'د. سمية الغريب',     target: 'الوزارة' },
  { name: 'الإنجازات السنوية',   freq: 'yearly',    owner: 'م. علي الزهراني',    target: 'الوزارة' },
  { name: 'الأحداث الجسيمة',     freq: 'yearly',    owner: 'أ. شادي نبيل',      target: 'الوزارة' },
  { name: 'المخاطر',            freq: 'yearly',    owner: 'أ. شادي نبيل',       target: 'الوزارة' },
  { name: 'السلامة الحيوية',     freq: 'yearly',    owner: 'أ. مشاعل المطيري',   target: 'الوزارة' },
  { name: 'التوطين',            freq: 'yearly',    owner: 'أ. محمد الحجيلي',    target: 'الوزارة' },
]

const FREQ_LABEL = { weekly: 'أسبوعي', monthly: 'شهري', quarterly: 'ربعي', yearly: 'سنوي' }
const FREQ_COLOR = { weekly: '#3b82f6', monthly: '#8b5cf6', quarterly: '#f59e0b', yearly: '#10b981' }
const FREQ_ICON  = { weekly: '📅', monthly: '📆', quarterly: '📊', yearly: '🗓' }
const FREQ_TABS = [
  { id: 'all', label: 'الكل', icon: '📋' },
  { id: 'weekly', label: 'أسبوعي', icon: '📅' },
  { id: 'monthly', label: 'شهري', icon: '📆' },
  { id: 'quarterly', label: 'ربعي', icon: '📊' },
  { id: 'yearly', label: 'سنوي', icon: '🗓' },
]

function getNextDueDate(freq) {
  const d = new Date()
  switch (freq) {
    case 'weekly': { const day = d.getDay(); d.setDate(d.getDate() + (day === 0 ? 7 : 7 - day)); break }
    case 'monthly': { d.setMonth(d.getMonth() + 1, 1); break }
    case 'quarterly': { const cq = Math.floor(d.getMonth() / 3); d.setMonth((cq + 1) * 3, 1); break }
    case 'yearly': { d.setFullYear(d.getFullYear() + 1, 0, 1); break }
    default: break
  }
  d.setHours(0,0,0,0); return d
}
function getDaysUntil(date) { const n = new Date(); n.setHours(0,0,0,0); return Math.ceil((date - n) / 86400000) }
function formatDateAr(d) { return d.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' }) }
function isDeliveredThisCycle(r) {
  if (!r.lastDelivered) return false
  const last = new Date(r.lastDelivered), now = new Date()
  switch (r.freq) {
    case 'weekly': return (now - last) / 86400000 < 7
    case 'monthly': return last.getMonth() === now.getMonth() && last.getFullYear() === now.getFullYear()
    case 'quarterly': return Math.floor(last.getMonth()/3) === Math.floor(now.getMonth()/3) && last.getFullYear() === now.getFullYear()
    case 'yearly': return last.getFullYear() === now.getFullYear()
    default: return false
  }
}

/* حساب عدد الدورات المتتالية بدون تسليم */
function getMissedCycles(r) {
  if (!r.freq || isDeliveredThisCycle(r)) return 0
  const deliveries = r.deliveries || []
  const lastDate = r.lastDelivered ? new Date(r.lastDelivered) : null
  if (!lastDate) return '∞' // ما سُلّم أبداً
  const now = new Date()
  let missed = 0
  switch (r.freq) {
    case 'weekly': missed = Math.floor((now - lastDate) / (7 * 86400000)); break
    case 'monthly': missed = (now.getFullYear() - lastDate.getFullYear()) * 12 + now.getMonth() - lastDate.getMonth(); break
    case 'quarterly': missed = Math.floor(((now.getFullYear() - lastDate.getFullYear()) * 12 + now.getMonth() - lastDate.getMonth()) / 3); break
    case 'yearly': missed = now.getFullYear() - lastDate.getFullYear(); break
  }
  return Math.max(0, missed)
}

/* شريط بصري لآخر 8 دورات */
function getCycleHistory(r) {
  const deliveries = r.deliveries || []
  if (deliveries.length === 0) return []
  return deliveries.slice(-8).map(d => ({
    delivered: true,
    date: d.timestamp ? new Date(d.timestamp).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' }) : '',
  }))
}

export default function BusinessReportsPage({ tasks, showToast }) {
  const { userProfile, isAdmin } = useAuth()
  const userName = userProfile?.name || ''
  const [reports, setReports] = useState([])
  const [activeFreq, setActiveFreq] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedReport, setSelectedReport] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editReport, setEditReport] = useState(null)
  const [seeded, setSeeded] = useState(false)

  useEffect(() => {
    const unsub = subscribeToBusinessReports(data => {
      setReports(data)
      if (data.length === 0 && !seeded) { setSeeded(true); seedReports() }
    })
    return unsub
  }, [seeded])

  async function seedReports() {
    for (const r of SEED_REPORTS) await addBusinessReport({ ...r, deliveries: [], lastDelivered: null })
  }

  const enriched = useMemo(() => reports.map(r => {
    const nextDue = getNextDueDate(r.freq)
    const missed = getMissedCycles(r)
    const history = getCycleHistory(r)
    return { ...r, nextDue, daysUntil: getDaysUntil(nextDue), delivered: isDeliveredThisCycle(r), missed, history }
  }), [reports])

  const filtered = useMemo(() => {
    let list = enriched
    if (activeFreq !== 'all') list = list.filter(r => r.freq === activeFreq)
    if (searchQuery.trim()) { const q = searchQuery.toLowerCase(); list = list.filter(r => r.name.toLowerCase().includes(q) || (r.owner||'').toLowerCase().includes(q)) }
    return list.sort((a, b) => a.daysUntil - b.daysUntil)
  }, [enriched, activeFreq, searchQuery])

  const stats = useMemo(() => ({
    total: enriched.length,
    delivered: enriched.filter(r => r.delivered).length,
    overdue: enriched.filter(r => r.daysUntil < 0 && !r.delivered).length,
    upcoming: enriched.filter(r => r.daysUntil >= 0 && r.daysUntil <= 3 && !r.delivered).length,
  }), [enriched])

  async function handleDeliver(report) {
    try { await recordReportDelivery(report.id, { by: userName }); showToast('✅ تم تسجيل التسليم'); setSelectedReport(null) }
    catch { showToast('❌ خطأ') }
  }

  return (
    <PullToRefresh onRefresh={() => showToast('✓ محدّث')}>
      <div className="header">
        <div className="header-row">
          <div>
            <div className="header-title">📋 تقارير الأعمال</div>
            <div className="header-sub">{stats.total} تقرير دوري • PMO</div>
          </div>
          {isAdmin && (
            <button onClick={() => { setEditReport(null); setShowForm(true) }} style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', color: '#fff',
              border: 'none', cursor: 'pointer', fontFamily: 'var(--font)',
            }}>+ تقرير</button>
          )}
        </div>
      </div>
      <div className="page" style={{ paddingBottom: 90 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '12px 16px' }}>
          {[{ v: stats.total, l: 'إجمالي', c: 'var(--text)' },{ v: stats.overdue, l: 'متأخر', c: '#ef4444' },{ v: stats.upcoming, l: 'قريب', c: '#f59e0b' },{ v: stats.delivered, l: 'مُسلّم', c: '#10b981' }].map(s => (
            <div key={s.l} style={{ background: 'var(--card)', borderRadius: 12, padding: '10px 6px', textAlign: 'center', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, padding: '0 16px 10px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {FREQ_TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveFreq(tab.id)} style={{
              padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              whiteSpace: 'nowrap', fontFamily: 'var(--font)', border: 'none', cursor: 'pointer',
              background: activeFreq === tab.id ? 'linear-gradient(135deg,#3b82f6,#8b5cf6)' : 'var(--bg3)',
              color: activeFreq === tab.id ? '#fff' : 'var(--text2)',
            }}>{tab.icon} {tab.label}</button>
          ))}
        </div>
        <div style={{ padding: '0 16px 10px', position: 'relative' }}>
          <span style={{ position: 'absolute', right: 28, top: '50%', transform: 'translateY(-50%)', fontSize: 15, opacity: 0.45 }}>🔍</span>
          <input type="search" placeholder="ابحث بالاسم أو المسؤول..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 38px 9px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 14, outline: 'none' }} />
        </div>
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text3)', fontSize: 13 }}>📋 لا توجد تقارير</div>
          ) : filtered.map(r => {
            const isOD = r.daysUntil < 0 && !r.delivered
            const isUrg = r.daysUntil >= 0 && r.daysUntil <= 2 && !r.delivered
            return (
              <div key={r.id} onClick={() => setSelectedReport(r)} style={{
                padding: '12px 14px', borderRadius: 14, cursor: 'pointer',
                background: isOD ? 'rgba(239,68,68,0.06)' : r.delivered ? 'rgba(16,185,129,0.06)' : 'var(--card)',
                border: `1px solid ${isOD ? '#ef4444' : isUrg ? '#f59e0b' : r.delivered ? '#10b981' : 'var(--border)'}`,
                borderRight: `4px solid ${FREQ_COLOR[r.freq]}`, opacity: r.delivered ? 0.7 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, textDecoration: r.delivered ? 'line-through' : 'none' }}>
                      {r.delivered && <span>✅</span>}{r.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span>👤 {(r.owner||'').split(' ').slice(-1)[0]}</span>
                      <span style={{ color: FREQ_COLOR[r.freq] }}>{FREQ_ICON[r.freq]} {FREQ_LABEL[r.freq]}</span>
                      {r.target && <span>📤 {r.target}</span>}
                      {r.missed > 0 && <span style={{ color: '#ef4444', fontWeight: 700 }}>⚠️ {r.missed} {typeof r.missed === 'number' ? 'دورة فائتة' : 'لم يُسلّم'}</span>}
                    </div>
                    {/* شريط التسليمات */}
                    {r.history && r.history.length > 0 && (
                      <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
                        {r.history.map((h, idx) => (
                          <div key={idx} title={h.date} style={{
                            width: 14, height: 6, borderRadius: 3,
                            background: h.delivered ? '#10b981' : '#ef4444',
                          }} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'left', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: isOD ? '#ef4444' : isUrg ? '#f59e0b' : r.delivered ? '#10b981' : 'var(--text2)' }}>
                      {r.delivered ? '✅ مُسلّم' : r.daysUntil < 0 ? `متأخر ${Math.abs(r.daysUntil)} يوم` : r.daysUntil === 0 ? 'اليوم!' : `${r.daysUntil} يوم`}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>📅 {formatDateAr(r.nextDue)}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedReport && (
        <>
          <div onClick={() => setSelectedReport(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1001,
            background: 'var(--card)', borderRadius: '20px 20px 0 0', padding: '20px 16px',
            paddingBottom: 'max(20px, env(safe-area-inset-bottom))', maxHeight: '80vh', overflowY: 'auto',
          }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--bg3)', margin: '0 auto 16px' }} />
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', textAlign: 'center', marginBottom: 4 }}>{selectedReport.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', marginBottom: 16 }}>
              {FREQ_ICON[selectedReport.freq]} {FREQ_LABEL[selectedReport.freq]} • 👤 {selectedReport.owner} • 📤 {selectedReport.target || ''}
            </div>
            <div style={{
              padding: 14, borderRadius: 12, marginBottom: 12, textAlign: 'center',
              background: selectedReport.delivered ? 'rgba(16,185,129,0.1)' : selectedReport.daysUntil < 0 ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
              border: `1px solid ${selectedReport.delivered ? 'rgba(16,185,129,0.2)' : selectedReport.daysUntil < 0 ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)'}`,
            }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>{selectedReport.delivered ? '✅' : selectedReport.daysUntil < 0 ? '⚠️' : '📅'}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                {selectedReport.delivered ? 'تم التسليم لهذه الدورة' : selectedReport.daysUntil < 0 ? `متأخر ${Math.abs(selectedReport.daysUntil)} يوم` : `باقي ${selectedReport.daysUntil} يوم`}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>الموعد القادم: {formatDateAr(selectedReport.nextDue)}</div>
              {selectedReport.missed > 0 && (
                <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 700, marginTop: 6 }}>
                  ⚠️ {selectedReport.missed} {typeof selectedReport.missed === 'number' ? 'دورة متتالية بدون تسليم' : 'لم يُسلّم أبداً'}
                </div>
              )}
            </div>
            {!selectedReport.delivered && (
              <button onClick={() => handleDeliver(selectedReport)} style={{
                width: '100%', padding: 12, borderRadius: 12, fontSize: 15, fontWeight: 700,
                background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10,
              }}>✅ تسجيل تسليم التقرير</button>
            )}
            {selectedReport.deliveries?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>📜 سجل التسليمات</div>
                {selectedReport.deliveries.slice(-5).reverse().map((d, i) => (
                  <div key={i} style={{ padding: '8px 12px', borderRadius: 10, marginBottom: 4, background: 'var(--bg3)', fontSize: 12, color: 'var(--text2)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>👤 {d.by}</span>
                    <span>{new Date(d.timestamp).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              {isAdmin && <button onClick={() => { setEditReport(selectedReport); setShowForm(true); setSelectedReport(null) }} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6', cursor: 'pointer', fontFamily: 'inherit' }}>✏️ تعديل</button>}
              {isAdmin && <button onClick={async () => { await deleteBusinessReport(selectedReport.id); showToast('🗑 تم الحذف'); setSelectedReport(null) }} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit' }}>🗑 حذف</button>}
              <button onClick={() => setSelectedReport(null)} style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' }}>إغلاق</button>
            </div>
          </div>
        </>
      )}

      {/* Report Form */}
      {showForm && (
        <ReportForm report={editReport} onSave={async (data) => {
          try {
            if (editReport) { await updateBusinessReport(editReport.id, data); showToast('✏️ تم التعديل') }
            else { await addBusinessReport({ ...data, deliveries: [], lastDelivered: null }); showToast('✅ تم الإضافة') }
          } catch { showToast('❌ خطأ') }
          setShowForm(false); setEditReport(null)
        }} onClose={() => { setShowForm(false); setEditReport(null) }} />
      )}
    </PullToRefresh>
  )
}

/* ─── Report Form (مختلف عن فورم المهمة) ──────────── */
function ReportForm({ report, onSave, onClose }) {
  const [form, setForm] = useState({
    name: report?.name || '', freq: report?.freq || 'weekly',
    owner: report?.owner || '', target: report?.target || '', notes: report?.notes || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'flex-start', paddingTop: 'env(safe-area-inset-top, 60px)' }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 450, maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="modal-handle" />
        <h2 className="modal-title">{report ? '✏️ تعديل تقرير' : '📋 تقرير جديد'}</h2>
        <div className="form-group">
          <label className="form-label">اسم التقرير *</label>
          <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="مثال: تقرير المؤشرات الأسبوعي" />
        </div>
        <div className="form-group">
          <label className="form-label">التكرار</label>
          <div className="seg-control">
            {Object.entries(FREQ_LABEL).map(([k, v]) => (
              <button key={k} className={`seg-btn${form.freq === k ? ' active' : ''}`} onClick={() => set('freq', k)}>{FREQ_ICON[k]} {v}</button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">المسؤول</label>
          <select className="form-input" value={form.owner} onChange={e => set('owner', e.target.value)}>
            <option value="">— اختر —</option>
            {TEAM_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">الجهة المستهدفة</label>
          <input className="form-input" value={form.target} onChange={e => set('target', e.target.value)} placeholder="المدير التنفيذي، الوزارة..." />
        </div>
        <div className="form-group">
          <label className="form-label">ملاحظات</label>
          <textarea className="form-input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="ملاحظات..." style={{ minHeight: 60, resize: 'vertical' }} />
        </div>
        <button className="submit-btn" onClick={() => { if (form.name.trim()) onSave(form) }} disabled={!form.name.trim()}>
          {report ? 'حفظ التغييرات' : '📋 إضافة التقرير'}
        </button>
        <button className="cancel-btn" onClick={onClose}>إلغاء</button>
      </div>
    </div>
  )
}
