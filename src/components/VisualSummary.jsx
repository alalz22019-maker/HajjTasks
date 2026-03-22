import { useState, useRef } from 'react'
import { toPng } from 'html-to-image'
import { generateVisualSummary } from '../utils/claude'

function formatArabicDate() {
  return new Date().toLocaleDateString('ar-SA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
}

// Section header colors (bold solid color bars like in the screenshot)
const SC = {
  urgent:   '#e63946',
  projects: '#457b9d',
  people:   '#6a4c93',
  done:     '#2d6a4f',
  recs:     '#b45309',
}

// Mind-map area dimensions
const W       = 390   // card width
const H       = 360   // mind-map area height
const CX      = W / 2 // center x
const CY      = H / 2 // center y
const HUB_R   = 52    // hub radius
const CARD_W  = 138   // section card width
const CARD_H  = 115   // approx card height (for arrow anchoring)

// Quadratic Bézier curves: from card inner corner → hub edge, through CX,CY as control point
const ARROWS = [
  { id: 'urgent',   x1: W-5-CARD_W, y1: 12+CARD_H,   x2: CX+HUB_R*0.7, y2: CY-HUB_R*0.7 },
  { id: 'projects', x1: 5+CARD_W,   y1: 12+CARD_H,   x2: CX-HUB_R*0.7, y2: CY-HUB_R*0.7 },
  { id: 'people',   x1: W-5-CARD_W, y1: H-12-CARD_H, x2: CX+HUB_R*0.7, y2: CY+HUB_R*0.7 },
  { id: 'done',     x1: 5+CARD_W,   y1: H-12-CARD_H, x2: CX-HUB_R*0.7, y2: CY+HUB_R*0.7 },
]

export default function VisualSummary({ tasks, apiKey }) {
  const [summary, setSummary]     = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [exporting, setExporting] = useState(false)
  const cardRef = useRef(null)

  const total     = tasks.length
  const doneCnt   = tasks.filter(t => t.done).length
  const urgentCnt = tasks.filter(t => t.priority === 'urgent' && !t.done).length
  const overdue   = tasks.filter(t => !t.done && t.dueDate && new Date(t.dueDate) < new Date()).length
  const pct       = total ? Math.round((doneCnt / total) * 100) : 0

  async function handleGenerate() {
    if (!apiKey) { setError('أضف مفتاح API أولاً'); return }
    setLoading(true); setError(''); setSummary(null)
    try {
      const result = await generateVisualSummary(apiKey, tasks)
      if (!result) throw new Error('لم يتم إنشاء الملخص')
      setSummary(result)
    } catch (e) {
      setError(e.message || 'حدث خطأ غير متوقع')
    } finally { setLoading(false) }
  }

  async function handleDownload() {
    if (!cardRef.current) return
    setExporting(true)
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true })
      const link = document.createElement('a')
      link.download = `ملخص-المهام-${new Date().toISOString().slice(0,10)}.png`
      link.href = dataUrl; link.click()
    } catch { setError('تعذّر تحميل الصورة') }
    finally { setExporting(false) }
  }

  async function handleShare() {
    if (!cardRef.current) return
    setExporting(true)
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true })
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], 'ملخص-المهام.png', { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'ملخص المهام' })
      } else {
        const link = document.createElement('a')
        link.download = 'ملخص-المهام.png'
        link.href = dataUrl; link.click()
      }
    } catch { setError('تعذّرت المشاركة') }
    finally { setExporting(false) }
  }

  const getSection = id => summary?.sections.find(s => s.id === id)

  // Colored-header section card, absolutely positioned inside the mind-map area
  function SectionCard({ sec, posStyle }) {
    if (!sec) return null
    const color = SC[sec.id] || SC.recs
    return (
      <div style={{
        position: 'absolute',
        width: CARD_W,
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 3px 14px rgba(0,0,0,0.15)',
        ...posStyle,
      }}>
        {/* Bold solid-color header bar */}
        <div style={{
          background: color,
          padding: '7px 10px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 15 }}>{sec.icon}</span>
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 800, lineHeight: 1.2 }}>{sec.title}</span>
        </div>
        {/* Item list */}
        <div style={{ background: '#fff', padding: '8px 10px' }}>
          {sec.items.map((item, i) => (
            <div key={i} style={{
              display: 'flex', gap: 5, alignItems: 'flex-start',
              marginBottom: i < sec.items.length - 1 ? 5 : 0,
            }}>
              <span style={{ color, fontWeight: 900, fontSize: 11, flexShrink: 0, lineHeight: 1.3 }}>•</span>
              <span style={{ fontSize: 10, color: '#1e293b', lineHeight: 1.4 }}>{item}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px', direction: 'rtl' }}>

      {/* Generate prompt */}
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
            cursor: 'pointer', fontFamily: 'inherit',
          }}>✨ إنشاء ملخص</button>
          {error && <div style={{ marginTop: 16, color: '#ef4444', fontSize: 13 }}>{error}</div>}
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
              cursor: 'pointer', fontFamily: 'inherit', opacity: exporting ? 0.6 : 1,
            }}>⬇️ تحميل PNG</button>
            <button onClick={handleShare} disabled={exporting} style={{
              flex: 1, background: '#10b981', color: '#fff', border: 'none',
              borderRadius: 10, padding: '10px', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', opacity: exporting ? 0.6 : 1,
            }}>📤 مشاركة</button>
            <button onClick={() => setSummary(null)} style={{
              background: 'rgba(255,255,255,0.08)', color: '#9090a8', border: 'none',
              borderRadius: 10, padding: '10px 14px', fontSize: 14,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>🔄</button>
          </div>
          {error && (
            <div style={{ marginBottom: 12, color: '#ef4444', fontSize: 13, textAlign: 'center' }}>{error}</div>
          )}

          {/* ── THE INFOGRAPHIC (captured by html-to-image) ── */}
          <div ref={cardRef} style={{
            width: W, maxWidth: '100%',
            background: '#faf8f0',
            borderRadius: 20,
            fontFamily: "'IBM Plex Sans Arabic', 'Segoe UI', system-ui, sans-serif",
            direction: 'rtl',
            overflow: 'hidden',
            boxShadow: '0 4px 28px rgba(0,0,0,0.18)',
          }}>

            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #1e3a5f 0%, #4a1d96 100%)',
              padding: '14px 18px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>🏥</span>
                <div>
                  <div style={{ color: '#fff', fontSize: 15, fontWeight: 800 }}>ملخص المهام البصري</div>
                  <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10 }}>PMO • وزارة الصحة السعودية</div>
                </div>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, textAlign: 'left' }}>
                {formatArabicDate()}
              </div>
            </div>

            {/* Mind-Map Area */}
            <div style={{ position: 'relative', width: '100%', height: H }}>

              {/* Subtle dot-grid background */}
              <div style={{
                position: 'absolute',
                top: 0, right: 0, bottom: 0, left: 0,
                backgroundImage: 'radial-gradient(circle, #c4b89a 1px, transparent 1px)',
                backgroundSize: '18px 18px',
                opacity: 0.45,
              }} />

              {/* SVG: curved dashed connecting lines + arrowheads */}
              <svg
                width={W} height={H}
                viewBox={`0 0 ${W} ${H}`}
                style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
              >
                <defs>
                  {ARROWS.map(a => (
                    <marker key={a.id} id={`ah-${a.id}`}
                      markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L6,3 z" fill={SC[a.id]} opacity="0.65" />
                    </marker>
                  ))}
                </defs>
                {ARROWS.map(a => (
                  <path
                    key={a.id}
                    d={`M ${a.x1} ${a.y1} Q ${CX} ${CY} ${a.x2} ${a.y2}`}
                    fill="none"
                    stroke={SC[a.id]}
                    strokeWidth="1.8"
                    strokeDasharray="5,4"
                    opacity="0.5"
                    markerEnd={`url(#ah-${a.id})`}
                  />
                ))}
              </svg>

              {/* 4 Section cards at 4 quadrants */}
              <SectionCard sec={getSection('urgent')}   posStyle={{ top: 12, right: 5 }} />
              <SectionCard sec={getSection('projects')} posStyle={{ top: 12, left: 5 }} />
              <SectionCard sec={getSection('people')}   posStyle={{ bottom: 12, right: 5 }} />
              <SectionCard sec={getSection('done')}     posStyle={{ bottom: 12, left: 5 }} />

              {/* Center Stats Hub */}
              <div style={{
                position: 'absolute',
                width: HUB_R * 2, height: HUB_R * 2,
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                background: '#fff',
                border: '3px solid #3b82f6',
                boxShadow: '0 6px 24px rgba(59,130,246,0.28)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                textAlign: 'center', padding: 6,
              }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>📋</span>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#1e3a5f', lineHeight: 1.1, marginTop: 3 }}>
                  {total}
                </div>
                <div style={{ fontSize: 9, color: '#64748b' }}>مهمة</div>
                <div style={{
                  fontSize: 15, fontWeight: 800, marginTop: 2,
                  color: pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444',
                }}>{pct}%</div>
                <div style={{ fontSize: 8, color: '#94a3b8' }}>إنجاز</div>
                <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                  {urgentCnt > 0 && <span style={{ fontSize: 8, color: '#ef4444' }}>🔴{urgentCnt}</span>}
                  {overdue   > 0 && <span style={{ fontSize: 8, color: '#f59e0b' }}>⚠️{overdue}</span>}
                </div>
              </div>
            </div>

            {/* Recommendations (full-width, below mind-map) */}
            {getSection('recs') && (() => {
              const sec = getSection('recs')
              return (
                <div style={{ borderTop: '2px solid #e8dcc8', padding: '12px 16px', background: '#fef3c7' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 16 }}>{sec.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#92400e' }}>{sec.title}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {sec.items.map((item, i) => (
                      <div key={i} style={{
                        background: '#fff',
                        border: '1.5px solid #fcd34d',
                        borderRadius: 20,
                        padding: '4px 10px',
                        fontSize: 10, color: '#78350f',
                      }}>{item}</div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Footer */}
            <div style={{
              background: '#1e3a5f',
              padding: '8px 16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)' }}>مهامي Pro • وزارة الصحة السعودية</span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)' }}>Claude AI ✦</span>
            </div>

          </div>
        </>
      )}
    </div>
  )
}
