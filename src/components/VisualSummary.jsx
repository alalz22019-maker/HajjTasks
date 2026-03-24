import { useState, useRef } from 'react'
import { generateVisualSummary, reviewByTaskExpert, reviewByLanguageExpert } from '../utils/claude'
import { loadData, saveData } from '../utils/storage'
import VisualSummaryCard from './VisualSummaryCard'
import { exportPNG, exportPDF, shareImage } from './VisualSummaryExport'

const STEPS = [
  { key: 'generate', icon: '⚙️', label: 'Claude يحلل المهام ويولّد التقرير...' },
  { key: 'task',     icon: '🔍', label: 'خبير إدارة المهام يراجع الأشخاص والأولويات...' },
  { key: 'lang',     icon: '✍️', label: 'مدقق اللغة العربية يصحح الصياغة...' },
]

function loadExcluded() {
  return new Set(loadData('mytasks_report_exclude') || [])
}
function saveExcluded(set) {
  saveData('mytasks_report_exclude', [...set])
}

export default function VisualSummary({ tasks, apiKey }) {
  const [summary,        setSummary]        = useState(null)
  const [loading,        setLoading]        = useState(false)
  const [step,           setStep]           = useState(null)
  const [error,          setError]          = useState('')
  const [exporting,      setExporting]      = useState(false)
  const [editMode,       setEditMode]       = useState(false)
  const [excludedPeople, setExcludedPeople] = useState(loadExcluded)
  const [showExclude,    setShowExclude]    = useState(false)
  const [newExclude,     setNewExclude]     = useState('')
  const cardRef = useRef(null)

  async function handleGenerate() {
    if (!apiKey) { setError('أضف مفتاح API أولاً'); return }
    setLoading(true); setError(''); setSummary(null); setEditMode(false)
    try {
      setStep('generate')
      let result = await generateVisualSummary(apiKey, tasks)
      if (!result) throw new Error('لم ينتج إنشاء اللوحة')

      setStep('task')
      result = await reviewByTaskExpert(apiKey, result, tasks)

      setStep('lang')
      result = await reviewByLanguageExpert(apiKey, result)

      // تطبيق قائمة الاستبعاد على قسم الفريق
      if (excludedPeople.size > 0 && result.peopleStatus) {
        result = {
          ...result,
          peopleStatus: result.peopleStatus.filter(p => !excludedPeople.has(p.name)),
        }
      }

      setSummary(result)
    } catch (e) {
      setError(e.message || 'حدث خطأ غير متوقع')
    } finally { setLoading(false); setStep(null) }
  }

  /* ── تعديل مباشر بعد التوليد ── */
  function removePerson(name) {
    setSummary(prev => ({
      ...prev,
      peopleStatus: prev.peopleStatus.filter(p => p.name !== name),
    }))
    // حفظ في قائمة الاستبعاد الدائمة تلقائياً
    setExcludedPeople(prev => {
      const next = new Set(prev)
      next.add(name)
      saveExcluded(next)
      return next
    })
  }

  function removeActionItem(idx) {
    setSummary(prev => ({
      ...prev,
      actionItems: prev.actionItems.filter((_, i) => i !== idx),
    }))
  }

  function removeRecommendation(idx) {
    setSummary(prev => ({
      ...prev,
      recommendations: prev.recommendations.filter((_, i) => i !== idx),
    }))
  }

  function removeOverviewItem(idx) {
    setSummary(prev => ({
      ...prev,
      overview: prev.overview.filter((_, i) => i !== idx),
    }))
  }

  /* ── قائمة الاستبعاد ── */
  function addExclude() {
    const name = newExclude.trim()
    if (!name) return
    setExcludedPeople(prev => {
      const next = new Set(prev)
      next.add(name)
      saveExcluded(next)
      return next
    })
    setNewExclude('')
  }

  function removeExclude(name) {
    setExcludedPeople(prev => {
      const next = new Set(prev)
      next.delete(name)
      saveExcluded(next)
      return next
    })
  }

  async function withExport(fn) {
    if (!cardRef.current) return
    const wasEdit = editMode
    setEditMode(false)          // أخفِ أزرار التعديل قبل التصدير
    setExporting(true); setError('')
    try { await fn(cardRef.current) }
    catch (e) { setError(e.message || 'تعذّر التصدير') }
    finally { setExporting(false); setEditMode(wasEdit) }
  }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

  return (
    <div style={{ padding: '16px', direction: 'rtl' }}>

      {/* ── شاشة البداية ── */}
      {!summary && !loading && (
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🎨</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e8e8f0', marginBottom: 8 }}>
            تقرير إدارة المهام
          </div>
          <div style={{ fontSize: 13, color: '#9090a8', marginBottom: 20 }}>
            ينشئ Claude ملخصاً تنفيذياً يساعدك على اتخاذ القرارات الصحيحة
          </div>

          {/* ── قائمة الاستبعاد ── */}
          <button
            onClick={() => setShowExclude(s => !s)}
            style={{
              background: 'none', border: '1px solid var(--border)',
              color: excludedPeople.size > 0 ? '#10b981' : '#9090a8',
              borderRadius: 10, padding: '7px 14px', fontSize: 12,
              cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto 16px',
            }}
          >
            🚫 استبعاد أشخاص من قسم الفريق
            {excludedPeople.size > 0 && (
              <span style={{
                background: '#10b981', color: '#fff', borderRadius: 10,
                padding: '1px 7px', fontSize: 11, fontWeight: 700,
              }}>{excludedPeople.size}</span>
            )}
            <span style={{ fontSize: 10 }}>{showExclude ? '▲' : '▼'}</span>
          </button>

          {showExclude && (
            <div style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '12px 14px', marginBottom: 20,
              textAlign: 'right',
            }}>
              <div style={{ fontSize: 12, color: '#9090a8', marginBottom: 10 }}>
                الأشخاص في هذه القائمة لن يظهروا في قسم "حالة الفريق" عند توليد التقرير
              </div>
              {[...excludedPeople].map(name => (
                <div key={name} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 10px', background: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, marginBottom: 6,
                }}>
                  <span style={{ fontSize: 13, color: '#e8e8f0' }}>{name}</span>
                  <button onClick={() => removeExclude(name)} style={{
                    background: 'none', border: 'none', color: '#C0392B',
                    cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1,
                  }}>✕</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input
                  value={newExclude}
                  onChange={e => setNewExclude(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addExclude()}
                  placeholder="اسم الشخص..."
                  style={{
                    flex: 1, padding: '8px 10px', background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 8,
                    color: '#e8e8f0', fontSize: 13, fontFamily: 'inherit',
                    outline: 'none', direction: 'rtl',
                  }}
                />
                <button onClick={addExclude} style={{
                  padding: '8px 14px', background: '#006B3F', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                  fontFamily: 'inherit', fontWeight: 600,
                }}>إضافة</button>
              </div>
            </div>
          )}

          <button onClick={handleGenerate} style={{
            background: 'linear-gradient(135deg, #006B3F, #28A265)',
            color: '#fff', border: 'none', borderRadius: 14,
            padding: '14px 32px', fontSize: 16, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>✨ إنشاء اللوحة</button>
          {error && <div style={{ marginTop: 16, color: '#C0392B', fontSize: 13 }}>{error}</div>}
        </div>
      )}

      {/* ── تحميل متعدد المراحل ── */}
      {loading && (
        <div style={{ padding: '40px 24px', direction: 'rtl' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🤖</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8f0' }}>
              جارٍ إعداد التقرير...
            </div>
            <div style={{ fontSize: 12, color: '#9090a8', marginTop: 4 }}>
              3 خبراء يعملون في الخلفية لرفع جودة التقرير
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {STEPS.map((s, i) => {
              const currentIdx = STEPS.findIndex(x => x.key === step)
              const isDone    = i < currentIdx
              const isActive  = s.key === step
              return (
                <div key={s.key} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 12,
                  background: isActive ? 'rgba(139,92,246,0.12)' : isDone ? 'rgba(16,185,129,0.08)' : 'var(--card)',
                  border: `1px solid ${isActive ? 'rgba(139,92,246,0.4)' : isDone ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                  transition: 'all 0.3s',
                  opacity: !isActive && !isDone ? 0.45 : 1,
                }}>
                  <div style={{ fontSize: 22, flexShrink: 0 }}>
                    {isDone ? '✅' : isActive ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2, display: 'inline-block' }} /> : s.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? '#e8e8f0' : isDone ? '#10b981' : '#9090a8' }}>
                      {isDone ? s.label.replace('...', '') : s.label}
                    </div>
                    {isDone && <div style={{ fontSize: 11, color: '#10b981', marginTop: 2 }}>اكتملت المراجعة</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── اللوحة ── */}
      {summary && (
        <>
          {/* أزرار التصدير + التعديل */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button onClick={() => withExport(exportPNG)} disabled={exporting} style={btnStyle('#0066B3', exporting)}>
              {isIOS ? '🖼️ حفظ' : '🖼️ PNG'}
            </button>
            <button onClick={() => withExport(exportPDF)} disabled={exporting} style={btnStyle('#006B3F', exporting)}>
              📄 PDF
            </button>
            <button onClick={() => withExport(shareImage)} disabled={exporting} style={btnStyle('#5B4FB8', exporting)}>
              📤 مشاركة
            </button>
            <button
              onClick={() => setEditMode(m => !m)}
              style={btnStyle(editMode ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.07)', false, editMode ? '#F59E0B' : '#9090a8')}
            >
              {editMode ? '✅ حفظ' : '✏️ تعديل'}
            </button>
            <button onClick={() => { setSummary(null); setEditMode(false) }} style={btnStyle('rgba(255,255,255,0.07)', false, '#9090a8')}>
              🔄
            </button>
          </div>

          {editMode && (
            <div style={{
              marginBottom: 12, padding: '10px 14px',
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 10, fontSize: 12, color: '#F59E0B', direction: 'rtl',
            }}>
              ✏️ وضع التعديل — اضغط ✕ لحذف أي عنصر. إخفاء شخص يحفظه في قائمة الاستبعاد تلقائياً.
            </div>
          )}

          {error && <div style={{ marginBottom: 12, color: '#C0392B', fontSize: 13, textAlign: 'center' }}>{error}</div>}

          <VisualSummaryCard
            cardRef={cardRef}
            summary={summary}
            tasks={tasks}
            editMode={editMode}
            onRemovePerson={removePerson}
            onRemoveActionItem={removeActionItem}
            onRemoveRecommendation={removeRecommendation}
            onRemoveOverviewItem={removeOverviewItem}
          />
        </>
      )}
    </div>
  )
}

function btnStyle(bg, disabled, color = '#fff') {
  return {
    flex: 1, minWidth: 60,
    background: bg, color, border: 'none',
    borderRadius: 10, padding: '10px 8px',
    fontSize: 13, fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'inherit',
    opacity: disabled ? 0.6 : 1,
  }
}
