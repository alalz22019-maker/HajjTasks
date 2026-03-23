import { D, KPI_PALETTE, MATRIX_CFG, CARD, formatDates } from './VisualSummaryColors'

function SectionLabel({ icon, label, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: color || D.text2 }}>{label}</span>
    </div>
  )
}

export default function VisualSummaryCard({ cardRef, summary, tasks }) {
  const today   = new Date()
  const total   = tasks.length
  const doneCnt = tasks.filter(t => t.done).length
  const pct     = total ? Math.round((doneCnt / total) * 100) : 0

  const fallbackKPIs = [
    { label: 'نسبة الإنجاز',  value: `${pct}%`,                                                       icon: '📈', color: 'blue'   },
    { label: 'تحتاج قراراً',  value: tasks.filter(t => t.priority === 'urgent' && !t.done).length,    icon: '⚡', color: 'red'    },
    { label: 'مهام متأخرة',   value: tasks.filter(t => !t.done && t.dueDate && new Date(t.dueDate) < today).length, icon: '⚠️', color: 'yellow' },
    { label: 'على المسار',    value: doneCnt,                                                          icon: '✅', color: 'green'  },
  ]
  const kpis = summary?.kpis?.length ? summary.kpis : fallbackKPIs
  const { hijri, gregorianEn } = formatDates()

  const barColor = pct >= 70 ? D.green : pct >= 40 ? D.yellow : D.red

  return (
    <div ref={cardRef} style={{
      width: 390,
      maxWidth: '100%',
      background: D.bg,
      borderRadius: 20,
      fontFamily: "'IBM Plex Sans Arabic','Segoe UI',system-ui,sans-serif",
      direction: 'rtl',
      boxShadow: '0 4px 24px rgba(0,107,63,0.13)',
      border: `1px solid ${D.border}`,
    }}>

      {/* ── HEADER ── */}
      <div style={{
        background: 'linear-gradient(135deg, #004D2C 0%, #006B3F 100%)',
        borderRadius: '20px 20px 0 0',
        padding: '18px 20px 16px',
      }}>
        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ color: '#FFFFFF', fontSize: 17, fontWeight: 900, lineHeight: 1.2, marginBottom: 3 }}>
              {summary.title || 'الملخص التنفيذي'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10 }}>
              مكتب إدارة المشاريع • مركز عمليات المختبرات
            </div>
          </div>
          {/* HSSC badge */}
          <div style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 8, padding: '4px 10px',
            fontSize: 10, fontWeight: 700, color: '#FFFFFF',
          }}>HSSC</div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.2)', marginBottom: 10 }} />

        {/* Dates */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)' }}>📅</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{hijri}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>📆</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', direction: 'ltr' }}>{gregorianEn}</span>
          </div>
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
                boxShadow: `0 2px 10px ${col.glow}`,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: `${col.color}15`,
                  border: `1px solid ${col.color}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, flexShrink: 0,
                }}>{kpi.icon}</div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: col.color, lineHeight: 1 }}>{kpi.value}</div>
                  <div style={{ fontSize: 10, color: D.text2, marginTop: 2 }}>{kpi.label}</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── PROGRESS BAR ── */}
        <div style={{
          background: CARD.background, borderRadius: CARD.borderRadius,
          border: `1px solid ${D.border}`, padding: CARD.padding,
          boxShadow: CARD.boxShadow,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <SectionLabel icon="📊" label="تقدم الإنجاز" color={D.blue} />
            <span style={{ fontSize: 13, fontWeight: 800, color: barColor }}>{pct}%</span>
          </div>
          <div style={{ height: 8, background: D.bg3, borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`, borderRadius: 99,
              background: pct >= 70
                ? 'linear-gradient(90deg,#006B3F,#28A265)'
                : pct >= 40
                ? 'linear-gradient(90deg,#D4770A,#F59E0B)'
                : 'linear-gradient(90deg,#C0392B,#E74C3C)',
            }} />
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
              background: D.bg2, border: `2px solid ${D.border}`,
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
            border: `1px solid ${D.border}`, padding: CARD.padding, boxShadow: CARD.boxShadow,
          }}>
            <SectionLabel icon="🎯" label="الملخص التنفيذي" color={D.blue} />
            {summary.overview.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, alignItems: 'flex-start' }}>
                <div style={{
                  width: 5, height: 5, borderRadius: '50%', background: D.green,
                  flexShrink: 0, marginTop: 6,
                }} />
                <span style={{ fontSize: 11, color: D.text, lineHeight: 1.6 }}>{item}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── PEOPLE STATUS ── */}
        {summary.peopleStatus?.length > 0 && (
          <div style={{
            background: D.redBg, border: `1px solid ${D.red}20`,
            borderRadius: 14, padding: '14px 16px',
          }}>
            <SectionLabel icon="👥" label="حالة الفريق — المهام المعلقة" color={D.red} />
            {summary.peopleStatus.map((person, i) => (
              <div key={i} style={{ marginBottom: i < summary.peopleStatus.length - 1 ? 10 : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: '#FFFFFF', border: `1px solid ${D.red}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, flexShrink: 0,
                    }}>👤</div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: D.text }}>{person.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <span style={{ fontSize: 9, color: D.text2, background: D.bg2, borderRadius: 4, padding: '2px 7px' }}>
                      {person.pending?.length || 0} معلقة
                    </span>
                    {person.overdueCount > 0 && (
                      <span style={{ fontSize: 9, color: D.red, background: '#FFFFFF', borderRadius: 4, padding: '2px 7px', border: `1px solid ${D.red}30` }}>
                        {person.overdueCount} متأخرة
                      </span>
                    )}
                  </div>
                </div>
                {(person.pending || []).map((t, j) => (
                  <div key={j} style={{ display: 'flex', gap: 5, marginBottom: 2, alignItems: 'center', paddingRight: 28 }}>
                    <span style={{ color: D.red, fontSize: 10, flexShrink: 0 }}>○</span>
                    <span style={{ fontSize: 9, color: D.text2, lineHeight: 1.4 }}>{t}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── PROJECT BREAKDOWN ── */}
        {summary.projectBreakdown?.length > 0 && (
          <div>
            <SectionLabel icon="📁" label="حالة الفئات والمشاريع" color={D.blue} />
            {summary.projectBreakdown.map((proj, i) => {
              const projPct  = proj.total ? Math.round((proj.done / proj.total) * 100) : 0
              const projColor = projPct === 100 ? D.green : projPct >= 50 ? D.yellow : D.red
              return (
                <div key={i} style={{
                  background: CARD.background, borderRadius: 12,
                  border: `1px solid ${D.border}`, padding: '10px 12px',
                  marginBottom: i < summary.projectBreakdown.length - 1 ? 8 : 0,
                  boxShadow: CARD.boxShadow,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: D.text }}>{proj.category}</span>
                    <span style={{ fontSize: 12, fontWeight: 900, color: projColor }}>{proj.done}/{proj.total}</span>
                  </div>
                  <div style={{ height: 4, background: D.bg3, borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ height: '100%', width: `${projPct}%`, borderRadius: 99, background: projColor }} />
                  </div>
                  {proj.completed?.slice(0, 3).map((t, j) => (
                    <div key={j} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 1 }}>
                      <span style={{ color: D.green, fontSize: 9, flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 9, color: D.text3 }}>{t}</span>
                    </div>
                  ))}
                  {proj.pending?.slice(0, 3).map((t, j) => (
                    <div key={j} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 1 }}>
                      <span style={{ color: D.yellow, fontSize: 9, flexShrink: 0 }}>○</span>
                      <span style={{ fontSize: 9, color: D.text2 }}>{t}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {/* ── ACTION ITEMS ── */}
        {summary.actionItems?.length > 0 && (
          <div style={{
            background: CARD.background, borderRadius: CARD.borderRadius,
            border: `1px solid ${D.border}`, padding: CARD.padding, boxShadow: CARD.boxShadow,
          }}>
            <SectionLabel icon="⚡" label="مهام بحاجة إلى قرار" color={D.yellow} />
            {summary.actionItems.map((item, i) => {
              const hi    = item.priority === 'high'
              const label = item.task || item.text || ''
              return (
                <div key={i} style={{
                  marginBottom: i < summary.actionItems.length - 1 ? 7 : 0,
                  padding: '8px 10px', borderRadius: 9,
                  background: hi ? D.redBg : D.bg2,
                  border: `1px solid ${hi ? D.red + '22' : D.border}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: item.reason ? 3 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10 }}>{hi ? '🔴' : '🔵'}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: hi ? D.red : D.text }}>{label}</span>
                    </div>
                    {item.owner && (
                      <span style={{ fontSize: 9, color: D.text2, background: D.bg3, borderRadius: 4, padding: '2px 7px', flexShrink: 0 }}>{item.owner}</span>
                    )}
                  </div>
                  {item.reason && (
                    <span style={{ fontSize: 9, color: D.text2, paddingRight: 16, display: 'block', lineHeight: 1.4 }}>{item.reason}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── RECOMMENDATIONS ── */}
        {summary.recommendations?.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(0,107,63,0.06), rgba(91,79,184,0.06))',
            border: `1px solid rgba(0,107,63,0.18)`,
            borderRadius: 14, padding: '14px 16px',
          }}>
            <SectionLabel icon="💡" label="التوصيات الاستراتيجية" color={D.green} />
            {summary.recommendations.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                <div style={{
                  width: 19, height: 19, borderRadius: 6, flexShrink: 0,
                  background: D.greenBg, border: `1px solid rgba(0,107,63,0.25)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, color: D.green, fontWeight: 800,
                }}>{i + 1}</div>
                <span style={{ fontSize: 11, color: D.text, lineHeight: 1.6 }}>{item}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── TASK TABLE ── */}
        {tasks.length > 0 && (() => {
          const fmtDate = (d) => {
            if (!d) return '—'
            const dt = new Date(d)
            return `${dt.getDate()}/${dt.getMonth() + 1}`
          }
          const trunc = (s, n) => s && s.length > n ? s.slice(0, n) + '…' : (s || '—')
          const getStatus = (t) => {
            if (t.done) return { label: 'منجزة', color: D.green }
            if (t.dueDate && new Date(t.dueDate) < today) return { label: 'متأخرة', color: D.red }
            if (t.priority === 'urgent') return { label: 'عاجل', color: '#E8621A' }
            return { label: 'معلق', color: D.text3 }
          }
          const PRI  = { urgent: 0, high: 1, medium: 2, normal: 3, low: 4 }
          const top7 = [...tasks].sort((a, b) => {
            if (a.done !== b.done) return a.done ? 1 : -1
            const aOvd = !a.done && a.dueDate && new Date(a.dueDate) < today
            const bOvd = !b.done && b.dueDate && new Date(b.dueDate) < today
            if (aOvd !== bOvd) return aOvd ? -1 : 1
            return (PRI[a.priority] ?? 3) - (PRI[b.priority] ?? 3)
          }).slice(0, 7)

          const COL = ['45%', '16%', '21%', '18%']
          const SEP = `1px solid ${D.border}`
          const ROW = (cells) => (
            <div style={{ display: 'flex', flexDirection: 'row' }}>
              {cells.map((cell, ci) => (
                <div key={ci} style={{
                  width: COL[ci], padding: '6px 7px', boxSizing: 'border-box',
                  textAlign: ci === 0 ? 'right' : 'center',
                  borderLeft: ci < cells.length - 1 ? SEP : 'none',
                }}>
                  {cell}
                </div>
              ))}
            </div>
          )
          return (
            <div>
              <SectionLabel icon="📋" label="أبرز 7 مهام" color={D.text2} />
              <div style={{ borderRadius: 12, border: `1px solid ${D.border}`, overflow: 'hidden', boxShadow: CARD.boxShadow }}>
                <div style={{ background: D.bg3, borderBottom: `1px solid ${D.border}` }}>
                  {ROW(['المهمة', 'الموعد', 'المالك', 'الحالة'].map(h => (
                    <span style={{ fontSize: 8, fontWeight: 700, color: D.green }}>{h}</span>
                  )))}
                </div>
                {top7.map((t, i) => {
                  const st = getStatus(t)
                  return (
                    <div key={i} style={{
                      borderBottom: i < top7.length - 1 ? `1px solid ${D.border}` : 'none',
                      background: i % 2 === 1 ? D.bg2 : D.bg,
                    }}>
                      {ROW([
                        <span style={{ fontSize: 9, color: t.done ? D.text3 : D.text, lineHeight: 1.3, display: 'block' }}>{t.title}</span>,
                        <span style={{ fontSize: 8, color: D.text3 }}>{fmtDate(t.dueDate)}</span>,
                        <span style={{ fontSize: 8, color: D.text2 }}>{trunc(t.person, 9) || '—'}</span>,
                        <span style={{ fontSize: 8, color: st.color, fontWeight: 700 }}>{st.label}</span>,
                      ])}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

      </div>{/* end main content */}

      {/* ── FOOTER ── */}
      <div style={{
        background: D.bg3,
        borderTop: `1px solid ${D.border}`,
        borderRadius: '0 0 20px 20px',
        padding: '9px 18px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 9, color: D.text3 }}>تقرير مكتب إدارة المشاريع • مركز عمليات المختبرات</span>
        <span style={{ fontSize: 9, color: D.green, fontWeight: 700 }}>MOH</span>
      </div>

    </div>
  )
}
