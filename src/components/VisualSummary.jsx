import { useState, useRef } from 'react'
import { generateVisualSummary } from '../utils/claude'
import VisualSummaryCard from './VisualSummaryCard'
import { exportPNG, exportPDF, shareImage } from './VisualSummaryExport'

export default function VisualSummary({ tasks, apiKey }) {
  const [summary,   setSummary]   = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [exporting, setExporting] = useState(false)
  const cardRef = useRef(null)

  async function handleGenerate() {
    if (!apiKey) { setError('أضف مفتاح API أولاً'); return }
    setLoading(true); setError(''); setSummary(null)
    try {
      const result = await generateVisualSummary(apiKey, tasks)
      if (!result) throw new Error('لم ينتج إنشاء اللوحة')
      setSummary(result)
    } catch (e) {
      setError(e.message || 'حدث خطأ غير متوقع')
    } finally { setLoading(false) }
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
            الملخص التنفيذي
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

      {/* ── تحميل ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: '#9090a8' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
          <div>Claude يحلل المهام ويعد الملخص التنفيذي...</div>
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
