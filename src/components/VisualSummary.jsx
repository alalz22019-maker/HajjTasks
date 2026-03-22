import { useState, useRef } from 'react'
import { toPng } from 'html-to-image'
import { generateVisualSummary } from '../utils/claude'

function formatArabicDate() {
  return new Date().toLocaleDateString('ar-SA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
}

// Dark-mode color palette (hardcoded hex for html-to-image compatibility)
const D = {
  bg:       '#0f172a',
  bg2:      '#1e293b',
  bg3:      '#0d1624',
  border:   'rgba(148,163,184,0.15)',
  text:     '#f1f5f9',
  text2:    '#94a3b8',
  text3:    '#475569',
  green:    '#10b981', greenBg:  'rgba(16,185,129,0.1)',
  red:      '#ef4444', redBg:    'rgba(239,68,68,0.1)',
  blue:     '#3b82f6', blueBg:   'rgba(59,130,246,0.1)',
  yellow:   '#f59e0b', yellowBg: 'rgba(245,158,11,0.1)',
  gray:     '#94a3b8', grayBg:   'rgba(148,163,184,0.08)',
  purple:   '#a78bfa', purpleBg: 'rgba(167,139,250,0.1)',
}

const KPI_PALETTE = {
  green:  { color: D.green,  bg: D.greenBg,  glow: 'rgba(16,185,129,0.18)'  },
  red:    { color: D.red,    bg: D.redBg,    glow: 'rgba(239,68,68,0.18)'   },
  blue:   { color: D.blue,   bg: D.blueBg,   glow: 'rgba(59,130,246,0.18)'  },
  gray:   { color: D.gray,   bg: D.grayBg,   glow: 'rgba(148,163,184,0.12)' },
  yellow: { color: D.yellow, bg: D.yellowBg, glow: 'rgba(245,158,11,0.18)'  },
}

const MATRIX_CFG = [
  { key: 'urgentImportant',    label: 'عاجل ومهم',      icon: '🔴', color: D.red,    bg: D.redBg    },
  { key: 'importantNotUrgent', label: 'مهم وغير عاجل',  icon: '📌', color: D.blue,   bg: D.blueBg   },
  { key: 'urgentNotImportant', label: 'عاجل وغير مهم',  icon: '⚡', color: D.yellow, bg: D.yellowBg },
  { key: 'other',              label: 'أخرى',            icon: '📋', color: D.gray,   bg: D.grayBg   },
]

const CARD = {
  background: '#1e293b',
  borderRadius: 14,
  border: 'rgba(148,163,184,0.15)',
  padding: '14px 16px',
}

export default function VisualSummary({ tasks, apiKey }) {
  const [summary, setSummary]     = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [exporting, setExporting] = useState(false)
  const cardRef = useRef(null)

  const total      = tasks.length
  const doneCnt    = tasks.filter(t => t.done).length
  const urgentCnt  = tasks.filter(t => t.priority === 'urgent' && !t.done).length
  const pendingCnt = tasks.filter(t => !t.done && t.priority !== 'urgent').length
  const overdue    = tasks.filter(t => !t.done && t.dueDate && new Date(t.dueDate) < new Date()).length
  const pct        = total ? Math.round((doneCnt / total) * 100) : 0

  async function handleGenerate() {
    if (!apiKey) { setError('أضف مفتاح API أولاً'); return }
    setLoading(true); setError(''); setSummary(null)
    try {
      const result = await generateVisualSummary(apiKey, tasks)
      if (!result) throw new Error('لم يتج إنشاء اللوحة')
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
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], 'الملخص-التنفيذي.png', { type: 'image/png' })
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      if (isIOS && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'الملخص التنفيذي' })
      } else {
        const link = document.createElement('a')
        link.download = `الملخص-التنفيذي-${new Date().toISOString().slice(0,10)}.png`
        link.href = dataUrl; link.click()
      }
    } catch { setError('تعذّر تحميل الصورة') }
    finally { setExporting(false) }
  }

  async function handleShare() {
    if (!cardRef.current) return
    setExporting(true)
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true })
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], 'لوحة-المهام.png', { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'لوحة إدارة المهام' })
      } else {
        const link = document.createElement('a')
        link.download = 'لوحة-المهام.png'
        link.href = dataUrl; link.click()
      }
    } catch { setError('تعذّرت المشاركة') }
    finally { setExporting(false) }
  }

  // Fallback KPIs computed locally when Claude doesn't return them
  const fallbackKPIs = [
    { label: 'نسبة الإنجاز',     value: `${pct}%`,  icon: '📈', color: 'blue'   },
    { label: 'تحتاج قراراً',     value: urgentCnt,  icon: '⚡', color: 'red'    },
    { label: 'مهام متأخرة',      value: overdue,    icon: '⚠️', color: 'yellow' },
    { label: 'على المسار',       value: doneCnt,    icon: '✅', color: 'green'  },
  ]

  const kpis = summary?.kpis?.length ? summary.kpis : fallbackKPIs

  // Section divider label
  function SectionLabel({ icon, label, color }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: color || D.text2 }}>{label}</span>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px', direction: 'rtl' }}>

      {/* ── Generate prompt ── */}
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
            background: 'linear-gradient(135deg, #3b82f6, #7c3aed)',
            color: '#fff', border: 'none', borderRadius: 14,
            padding: '14px 32px', fontSize: 16, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>✨ إنشاء اللوحة</button>
          {error && <div style={{ marginTop: 16, color: '#ef4444', fontSize: 13 }}>{error}</div>}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: '#9090a8' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
          <div>Claude يحلل المهام ويعد الملخص التنفيذي...</div>
        </div>
      )}

      {/* ── Dashboard ── */}
      {summary && (
        <>
          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button onClick={handleDownload} disabled={exporting} style={{
              flex: 1, background: '#3b82f6', color: '#fff', border: 'none',
              borderRadius: 10, padding: '10px', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', opacity: exporting ? 0.6 : 1,
            }}>{/iPad|iPhone|iPod/.test(navigator.userAgent) ? '🖼️ حفظ في الصور' : '⬇️ تحميل PNG'}</button>
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
          {error && <div style={{ marginBottom: 12, color: '#ef4444', fontSize: 13, textAlign: 'center' }}>{error}</div>}

          {/* ════════════════════════════════
              THE INFOGRAPHIC (html-to-image)
              ════════════════════════════════ */}
          <div ref={cardRef} style={{
            width: 390, maxWidth: '100%',
            background: D.bg,
            borderRadius: 20,
            fontFamily: "'IBM Plex Sans Arabic', 'Segoe UI', system-ui, sans-serif",
            direction: 'rtl',
            overflow: 'hidden',
            boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          }}>

            {/* ── HEADER ── */}
            <div style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #0f172a 100%)',
              borderBottom: '1px solid rgba(139,92,246,0.25)',
              padding: '18px 20px 14px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ color: D.text, fontSize: 16, fontWeight: 900, lineHeight: 1.2, marginBottom: 3 }}>
                    {summary.title || 'الملخص التنفيذي'}
                  </div>
                  <div style={{ color: D.text2, fontSize: 10 }}>تقرير القيادة • وزارة الصحة السعودية</div>
                </div>
                {/* Decorative UI chips */}
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <div style={{
                    background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)',
                    borderRadius: 6, padding: '3px 8px', fontSize: 9, color: D.blue,
                  }}>API</div>
                  <div style={{
                    background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.2)',
                    borderRadius: 6, padding: '3px 8px', fontSize: 9, color: D.text2,
                  }}>☰</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', background: D.green,
                  boxShadow: `0 0 6px ${D.green}`,
                }} />
                <span style={{ color: D.text3, fontSize: 10 }}>آخر تحديث: {formatArabicDate()}</span>
              </div>
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* ── KPI CARDS ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {kpis.map((kpi, i) => {
                  const col = KPI_PALETTE[kpi.color] || KPI_PALETTE.gray
                  return (
                    <div key={i} style={{
                      background: col.bg,
                      border: `1px solid ${col.color}30`,
                      borderRadius: 14, padding: '12px 13px',
                      boxShadow: `0 4px 16px ${col.glow}`,
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 10,
                        background: `${col.color}18`,
                        border: `1px solid ${col.color}30`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, flexShrink: 0,
                      }}>{kpi.icon}</div>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: col.color, lineHeight: 1 }}>
                          {kpi.value}
                        </div>
                        <div style={{ fontSize: 10, color: D.text2, marginTop: 2 }}>{kpi.label}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* ── PROGRESS BAR ── */}
              <div style={{
                background: CARD.background, borderRadius: CARD.borderRadius,
                border: `1px solid ${CARD.border}`, padding: CARD.padding,
                boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <SectionLabel icon="📊" label="تقدم الإنجاز" color={D.blue} />
                  <span style={{
                    fontSize: 13, fontWeight: 800,
                    color: pct >= 70 ? D.green : pct >= 40 ? D.yellow : D.red,
                  }}>{pct}%</span>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`, borderRadius: 99,
                    background: pct >= 70
                      ? 'linear-gradient(90deg,#10b981,#34d399)'
                      : pct >= 40
                      ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                      : 'linear-gradient(90deg,#ef4444,#f87171)',
                    boxShadow: pct >= 70 ? '0 0 8px rgba(16,185,129,0.45)' : undefined,
                  }} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  {[
                    { n: doneCnt,   label: 'منجزة',   c: D.green  },
                    { n: urgentCnt, label: 'عاجلة',   c: D.red    },
                    { n: overdue,   label: 'متأخرة',  c: D.yellow },
                    { n: total,     label: 'إجمالي',  c: D.text2  },
                  ].map((s, i) => (
                    <div key={i} style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{ fontSize: 17, fontWeight: 900, color: s.c }}>{s.n}</div>
                      <div style={{ fontSize: 9, color: D.text3 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── EISENHOWER MATRIX ── */}
              <div>
                <SectionLabel icon="⊞" label="مصفوفة تصنيف المهام (الأهمية × العجلة)" color={D.purple} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, position: 'relative' }}>
                  {MATRIX_CFG.map(q => {
                    const data = summary.matrix?.[q.key] || { count: 0, items: [] }
                    return (
                      <div key={q.key} style={{
                        background: q.bg,
                        border: `1px solid ${q.color}28`,
                        borderRadius: 12, padding: '10px 12px', minHeight: 85,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 12 }}>{q.icon}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: q.color }}>{q.label}</span>
                          </div>
                          <div style={{
                            background: `${q.color}20`, border: `1px solid ${q.color}40`,
                            borderRadius: 20, padding: '1px 7px',
                            fontSize: 12, fontWeight: 900, color: q.color,
                          }}>{data.count}</div>
                        </div>
                        {(data.items || []).slice(0, 3).map((item, i) => (
                          <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 2, alignItems: 'flex-start' }}>
                            <span style={{ color: q.color, fontSize: 10, flexShrink: 0, lineHeight: 1.4 }}>›</span>
                            <span style={{ fontSize: 9, color: D.text2, lineHeight: 1.4 }}>{item}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                  {/* Center crosshair */}
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%,-50%)',
                    width: 22, height: 22, borderRadius: '50%',
                    background: D.bg3, border: `2px solid ${D.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, color: D.text3,
                  }}>+</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, padding: '0 2px' }}>
                  <span style={{ fontSize: 8, color: D.text3 }}>← غير عاجل</span>
                  <span style={{ fontSize: 8, color: D.text3 }}>عاجل →</span>
                </div>
              </div>

              {/* ── OVERVIEW ── */}
              {summary.overview?.length > 0 && (
                <div style={{
                  background: CARD.background, borderRadius: CARD.borderRadius,
                  border: `1px solid ${D.border}`, padding: CARD.padding,
                }}>
                  <SectionLabel icon="🎯" label="الملخص التنفيذي" color={D.blue} />
                  {summary.overview.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 5, height: 5, borderRadius: '50%', background: D.blue,
                        flexShrink: 0, marginTop: 6,
                      }} />
                      <span style={{ fontSize: 11, color: D.text, lineHeight: 1.6 }}>{item}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── CHALLENGES ── */}
              {summary.challenges?.length > 0 && (
                <div style={{
                  background: 'rgba(239,68,68,0.06)',
                  border: `1px solid ${D.red}20`,
                  borderRadius: 14, padding: '14px 16px',
                }}>
                  <SectionLabel icon="⚠️" label="عوائق تحتاج تدخلاً" color={D.red} />
                  {summary.challenges.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, alignItems: 'flex-start' }}>
                      <span style={{ color: D.red, fontSize: 13, flexShrink: 0, lineHeight: 1.3 }}>!</span>
                      <span style={{ fontSize: 11, color: D.text, lineHeight: 1.6 }}>{item}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── INSIGHTS ── */}
              {summary.insights?.length > 0 && (
                <div>
                  <SectionLabel icon="📊" label="مؤشرات القيادة" color={D.purple} />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {summary.insights.map((ins, i) => (
                      <div key={i} style={{
                        background: CARD.background,
                        border: `1px solid ${D.border}`,
                        borderRadius: 12, padding: '11px 14px',
                        flex: '1 1 calc(33% - 6px)',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 17, fontWeight: 900, color: D.purple }}>{ins.value}</div>
                        <div style={{ fontSize: 9, color: D.text3, marginTop: 3 }}>{ins.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── ACTION ITEMS ── */}
              {summary.actionItems?.length > 0 && (
                <div style={{
                  background: CARD.background, borderRadius: CARD.borderRadius,
                  border: `1px solid ${D.border}`, padding: CARD.padding,
                }}>
                  <SectionLabel icon="⚡" label="قرارات تحتاج موافقتك" color={D.yellow} />
                  {summary.actionItems.map((item, i) => {
                    const hi = item.priority === 'high'
                    return (
                      <div key={i} style={{
                        display: 'flex', gap: 8, alignItems: 'center',
                        marginBottom: i < summary.actionItems.length - 1 ? 7 : 0,
                        padding: '7px 10px', borderRadius: 9,
                        background: hi ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${hi ? D.red + '22' : D.border}`,
                      }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                          background: hi ? D.redBg : D.grayBg,
                          border: `1px solid ${hi ? D.red + '40' : D.border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10,
                        }}>{hi ? '🔴' : '🔵'}</div>
                        <span style={{ fontSize: 11, color: D.text, lineHeight: 1.4, flex: 1 }}>{item.text}</span>
                        {hi && (
                          <div style={{
                            background: D.redBg, border: `1px solid ${D.red}40`,
                            borderRadius: 20, padding: '2px 7px',
                            fontSize: 8, color: D.red, flexShrink: 0,
                          }}>عاجل</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── RECOMMENDATIONS ── */}
              {summary.recommendations?.length > 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.07), rgba(167,139,250,0.07))',
                  border: `1px solid rgba(167,139,250,0.2)`,
                  borderRadius: 14, padding: '14px 16px',
                }}>
                  <SectionLabel icon="💡" label="التوصيات الاستراتيجية" color={D.purple} />
                  {summary.recommendations.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 19, height: 19, borderRadius: 6, flexShrink: 0,
                        background: D.purpleBg, border: `1px solid rgba(167,139,250,0.3)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, color: D.purple, fontWeight: 800,
                      }}>{i + 1}</div>
                      <span style={{ fontSize: 11, color: D.text, lineHeight: 1.6 }}>{item}</span>
                    </div>
                  ))}
                </div>
              )}

            </div>

            {/* ── FOOTER ── */}
            <div style={{
              background: D.bg3,
              borderTop: `1px solid ${D.border}`,
              padding: '9px 18px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 9, color: D.text3 }}>تقرير القيادة • وزارة الصحة السعودية</span>
              <span style={{ fontSize: 9, color: D.text3 }}>Claude AI ✦</span>
            </div>

          </div>
        </>
      )}
    </div>
  )
}
