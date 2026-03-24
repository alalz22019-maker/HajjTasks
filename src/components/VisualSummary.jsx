import { useState, useRef } from 'react'
import { generateVisualSummary, reviewByTaskExpert, reviewByLanguageExpert } from '../utils/claude'
import VisualSummaryCard from './VisualSummaryCard'
import { exportPNG, exportPDF, shareImage } from './VisualSummaryExport'

const STEPS = [
  { key: 'generate', icon: '⚙️', label: 'Claude يحلل المهام ويولّد التقرير...' },
  { key: 'task',     icon: '🔍', label: 'خبير إدارة المهام يراجع الأشخاص والأولويات...' },
  { key: 'lang',     icon: '✍️', label: 'مدقق اللغة العربية يصحح الصياغة...' },
]

export default function VisualSummary({ tasks, apiKey }) {
  const [summary,   setSummary]   = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [step,      setStep]      = useState(null)   // 'generate' | 'task' | 'lang'
  const [error,     setError]     = useState('')
  const [exporting, setExporting] = useState(false)
  const cardRef = useRef(null)

  async function handleGenerate() {
    if (!apiKey) { setError('أضف مفتاح API أولاً'); return }
    setLoading(true); setError(''); setSummary(null)
    try {
      // المرحلة 1: توليد التقرير الأولي
      setStep('generate')
      let result = await generateVisualSummary(apiKey, tasks)
      if (!result) throw new Error('لم ينتج إنشاء اللوحة')

      // المرحلة 2: مراجعة خبير إدارة المهام
      setStep('task')
      result = await reviewByTaskExpert(apiKey, result, tasks)

      // المرحلة 3: مراجعة مدقق اللغة العربية
      setStep('lang')
      result = await reviewByLanguageExpert(apiKey, result)

      setSummary(result)
    } catch (e) {
      setError(e.message || 'حدث خطأ غير متوقع')
    } finally { setLoading(false); setStep(null) }
  }

  async function withExport(fn) {
    if (!cardRef.current) return
    setExporting(true); setError('')
    try { await fn(cardRef.current) }
    catch (e) { setError(e.message || 'تعذّر التصدير') }
    finally { setExporting(false) }
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
          <div style={{ fontSize: 13, color: '#9090a8', marginBottom: 24 }}>
            ينشئ Claude ملخصاً تنفيذياً يساعدك على اتخاذ القرارات الصحيحة
          </div>
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
                    {isDone && (
                      <div style={{ fontSize: 11, color: '#10b981', marginTop: 2 }}>اكتملت المراجعة</div>
                    )}
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
          {/* أزرار التصدير */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button
              onClick={() => withExport(exportPNG)}
              disabled={exporting}
              style={btnStyle('#0066B3', exporting)}
            >{isIOS ? '🖼️ حفظ صورة' : '🖼️ PNG'}</button>

            <button
              onClick={() => withExport(exportPDF)}
              disabled={exporting}
              style={btnStyle('#006B3F', exporting)}
            >📄 PDF</button>

            <button
              onClick={() => withExport(shareImage)}
              disabled={exporting}
              style={btnStyle('#5B4FB8', exporting)}
            >📤 مشاركة</button>

            <button
              onClick={() => setSummary(null)}
              style={btnStyle('rgba(255,255,255,0.1)', false, '#9090a8')}
            >🔄</button>
          </div>

          {error && (
            <div style={{ marginBottom: 12, color: '#C0392B', fontSize: 13, textAlign: 'center' }}>
              {error}
            </div>
          )}

          <VisualSummaryCard cardRef={cardRef} summary={summary} tasks={tasks} />
        </>
      )}
    </div>
  )
}

function btnStyle(bg, disabled, color = '#fff') {
  return {
    flex: 1, minWidth: 70,
    background: bg, color, border: 'none',
    borderRadius: 10, padding: '10px 8px',
    fontSize: 13, fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'inherit',
    opacity: disabled ? 0.6 : 1,
  }
}
