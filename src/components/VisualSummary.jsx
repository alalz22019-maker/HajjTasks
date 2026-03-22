import { useState, useRef } from 'react'
import { toPng } from 'html-to-image'
import { generateVisualSummary } from '../utils/claude'

function formatArabicDate() {
  return new Date().toLocaleDateString('ar-SA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
}

// All styles are inline (hardcoded hex) so html-to-image can capture them correctly
const C = {
  bg:       '#ffffff',
  bg2:      '#f4f6fb',
  border:   '#e2e8f0',
  text:     '#1a1a2e',
  text2:    '#4a5568',
  text3:    '#718096',
  blue:     '#3b82f6',
  purple:   '#7c3aed',
  green:    '#10b981',
  red:      '#ef4444',
  orange:   '#f59e0b',
  gradient: 'linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%)',
}

const SECTION_COLORS = {
  urgent:   { border: '#ef4444', bg: '#fff5f5', text: '#ef4444' },
  projects: { border: '#3b82f6', bg: '#eff6ff', text: '#3b82f6' },
  people:   { border: '#7c3aed', bg: '#f5f3ff', text: '#7c3aed' },
  done:     { border: '#10b981', bg: '#f0fdf4', text: '#10b981' },
  recs:     { border: '#f59e0b', bg: '#fffbeb', text: '#f59e0b' },
}

export default function VisualSummary({ tasks, apiKey }) {
  const [summary, setSummary]   = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [exporting, setExporting] = useState(false)
  const cardRef = useRef(null)

  const total   = tasks.length
  const done    = tasks.filter(t => t.done).length
  const urgent  = tasks.filter(t => t.priority === 'urgent' && !t.done).length
  const overdue = tasks.filter(t => !t.done && t.dueDate && new Date(t.dueDate) < new Date()).length
  const pct     = total ? Math.round((done / total) * 100) : 0

  async function handleGenerate() {
    if (!apiKey) { setError('أضف مفتاح API أولاً'); return }
    setLoading(true)
    setError('')
    setSummary(null)
    try {
      const result = await generateVisualSummary(apiKey, tasks)
      if (!result) throw new Error('لم يتم إنشاء الملخص')
      setSummary(result)
    } catch (e) {
      setError(e.message || 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  async function handleDownload() {
    if (!cardRef.current) return
    setExporting(true)
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true })
      const link = document.createElement('a')
      link.download = `ملخص-المهام-${new Date().toISOString().slice(0,10)}.png`
      link.href = dataUrl
      link.click()
    } catch {
      setError('تعذّر تحميل الصورة')
    } finally {
      setExporting(false)
    }
  }

  async function handleShare() {
    if (!cardRef.current) return
    setExporting(true)
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true })
      const res     = await fetch(dataUrl)
      const blob    = await res.blob()
      const file    = new File([blob], 'ملخص-المهام.png', { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'ملخص المهام' })
      } else {
        // Fallback: download
        const link = document.createElement('a')
        link.download = 'ملخص-المهام.png'
        link.href = dataUrl
        link.click()
      }
    } catch {
      setError('تعذّرت المشاركة')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{ padding: '16px', direction: 'rtl' }}>

      {/* Generate button */}
      {!summary && !loading && (
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🎨</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e8e8f0', marginBottom: 8 }}>
            الملخص البصري
          </div>
          <div style={{ fontSize: 13, color: '#9090a8', marginBottom: 24 }}>
            ينشئ لك Claude صورة احترافية بجميع أبرز مهامك
          </div>
          <button onClick={handleGenerate} style={{
            background: 'linear-gradient(135deg, #3b82f6, #7c3aed)',
            color: '#fff', border: 'none', borderRadius: 14,
            padding: '14px 32px', fontSize: 16, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit'
          }}>
            ✨ إنشاء ملخص
          </button>
          {error && (
            <div style={{ marginTop: 16, color: '#ef4444', fontSize: 13 }}>{error}</div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: '#9090a8' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
          <div>Claude يحلل مهامك...</div>
        </div>
      )}

      {/* Infographic */}
      {summary && (
        <>
          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button onClick={handleDownload} disabled={exporting} style={{
              flex: 1, background: '#3b82f6', color: '#fff', border: 'none',
              borderRadius: 10, padding: '10px', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', opacity: exporting ? 0.6 : 1
            }}>
              ⬇️ تحميل PNG
            </button>
            <button onClick={handleShare} disabled={exporting} style={{
              flex: 1, background: '#10b981', color: '#fff', border: 'none',
              borderRadius: 10, padding: '10px', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', opacity: exporting ? 0.6 : 1
            }}>
              📤 مشاركة
            </button>
            <button onClick={() => setSummary(null)} style={{
              background: 'rgba(255,255,255,0.08)', color: '#9090a8', border: 'none',
              borderRadius: 10, padding: '10px 14px', fontSize: 14,
              cursor: 'pointer', fontFamily: 'inherit'
            }}>
              🔄
            </button>
          </div>
          {error && (
            <div style={{ marginBottom: 12, color: '#ef4444', fontSize: 13, textAlign: 'center' }}>{error}</div>
          )}

          {/* THE INFOGRAPHIC — captured by html-to-image */}
          <div ref={cardRef} style={{
            width: 390, maxWidth: '100%',
            background: C.bg, borderRadius: 20,
            fontFamily: "'IBM Plex Sans Arabic', 'Segoe UI', system-ui, sans-serif",
            direction: 'rtl', overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          }}>

            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%)',
              padding: '18px 20px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 24 }}>🏥</span>
                <div>
                  <div style={{ color: '#fff', fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>
                    ملخص المهام
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>
                    علي الزهراني • PMO وزارة الصحة
                  </div>
                </div>
                <div style={{ marginRight: 'auto', textAlign: 'left', color: 'rgba(255,255,255,0.85)', fontSize: 11 }}>
                  {formatArabicDate()}
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div style={{
              display: 'flex', background: C.bg2,
              borderBottom: `1px solid ${C.border}`,
            }}>
              {[
                { num: total,   label: 'إجمالي',  color: C.blue   },
                { num: done,    label: 'منجزة',   color: C.green  },
                { num: urgent,  label: 'عاجلة',   color: C.red    },
                { num: overdue, label: 'متأخرة',  color: C.orange },
              ].map((s, i) => (
                <div key={i} style={{
                  flex: 1, textAlign: 'center', padding: '10px 4px',
                  borderLeft: i < 3 ? `1px solid ${C.border}` : 'none',
                }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>
                    {s.num}
                  </div>
                  <div style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div style={{ padding: '8px 16px 4px', background: C.bg2, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: C.text3 }}>نسبة الإنجاز</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.green }}>{pct}%</span>
              </div>
              <div style={{ height: 6, background: C.border, borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: 'linear-gradient(90deg, #3b82f6, #10b981)',
                  borderRadius: 99,
                }} />
              </div>
            </div>

            {/* Sections Grid — first 4 sections in 2×2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: C.border }}>
              {summary.sections.slice(0, 4).map(sec => {
                const col = SECTION_COLORS[sec.id] || SECTION_COLORS.recs
                return (
                  <div key={sec.id} style={{
                    background: col.bg, padding: '12px 14px',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      marginBottom: 8,
                    }}>
                      <span style={{ fontSize: 14 }}>{sec.icon}</span>
                      <span style={{
                        fontSize: 12, fontWeight: 700, color: col.text,
                      }}>{sec.title}</span>
                    </div>
                    {sec.items.map((item, i) => (
                      <div key={i} style={{
                        fontSize: 11, color: C.text, marginBottom: 4,
                        display: 'flex', alignItems: 'flex-start', gap: 4,
                      }}>
                        <span style={{ color: col.text, flexShrink: 0, marginTop: 1 }}>•</span>
                        <span style={{ lineHeight: 1.4 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>

            {/* Recommendations — full width */}
            {summary.sections.find(s => s.id === 'recs') && (() => {
              const sec = summary.sections.find(s => s.id === 'recs')
              const col = SECTION_COLORS.recs
              return (
                <div style={{ background: col.bg, padding: '12px 16px', borderTop: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 14 }}>{sec.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: col.text }}>{sec.title}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {sec.items.map((item, i) => (
                      <div key={i} style={{
                        background: '#fff', border: `1px solid ${C.orange}22`,
                        borderRadius: 20, padding: '4px 10px',
                        fontSize: 11, color: C.text,
                      }}>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Footer */}
            <div style={{
              background: C.bg2, borderTop: `1px solid ${C.border}`,
              padding: '8px 16px', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 10, color: C.text3 }}>مهامي Pro • وزارة الصحة السعودية</span>
              <span style={{ fontSize: 10, color: C.text3 }}>تم إنشاؤه بواسطة Claude AI</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
