import { useMemo } from 'react'

const SUBCATEGORY_LABELS = {
  leaders: 'القادة', team: 'الفريق', other: 'أخرى',
  home: 'البيت', business: 'بيزنس'
}

function Section({ title, color, rows }) {
  return (
    <div className="report-section">
      <div className="report-section-title" style={{ borderColor: color }}>
        {title}
      </div>
      <div className="report-row">
        {rows.map(r => (
          <div key={r.label} className="report-card">
            <div className="report-card-num" style={{ background: `linear-gradient(135deg, ${color}, ${color}99)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {r.value}
            </div>
            <div className="report-card-label">{r.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SubcatSection({ title, tasks, color }) {
  const subs = useMemo(() => {
    const map = {}
    tasks.forEach(t => {
      const k = t.subcategory || 'other'
      if (!map[k]) map[k] = { total: 0, done: 0 }
      map[k].total++
      if (t.done) map[k].done++
    })
    return Object.entries(map).map(([k, v]) => ({ key: k, ...v }))
  }, [tasks])

  if (tasks.length === 0) return null

  return (
    <div className="report-section">
      <div className="report-section-title" style={{ borderColor: color }}>
        {title}
      </div>
      {subs.map(s => (
        <div key={s.key} style={{
          background: 'var(--card)', borderRadius: 12, padding: '12px 14px',
          marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: 15 }}>{SUBCATEGORY_LABELS[s.key] || s.key}</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>
              {s.done}/{s.total}
            </span>
            <div style={{
              width: 60, height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${s.total ? (s.done / s.total) * 100 : 0}%`,
                background: color, borderRadius: 3
              }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ReportsPage({ tasks }) {
  const work = tasks.filter(t => t.category === 'work')
  const personal = tasks.filter(t => t.category === 'personal')
  const health = tasks.filter(t => t.category === 'health')
  const all = tasks

  const totalPct = all.length ? Math.round((all.filter(t => t.done).length / all.length) * 100) : 0

  return (
    <div className="page">
      <div className="header">
        <div className="header-title">📊 التقارير</div>
        <div className="header-sub">إحصائيات تفصيلية • {all.length} مهمة</div>
      </div>

      {/* Overall */}
      <div className="report-section">
        <div className="report-section-title" style={{ borderColor: '#60a5fa' }}>
          الإجمالي — نسبة الإنجاز {totalPct}%
        </div>
        <div style={{ background: 'var(--card)', borderRadius: 12, padding: 14, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>التقدم</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{all.filter(t => t.done).length} / {all.length}</span>
          </div>
          <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${totalPct}%`,
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              borderRadius: 4, transition: 'width 0.5s'
            }} />
          </div>
        </div>
        <div className="report-row">
          {[
            { label: 'الكل', value: all.length, color: '#60a5fa' },
            { label: 'معلقة', value: all.filter(t => !t.done).length, color: '#9090a8' },
            { label: 'مكتملة', value: all.filter(t => t.done).length, color: '#10b981' },
            { label: 'عاجل', value: all.filter(t => t.priority === 'urgent' && !t.done).length, color: '#ef4444' },
          ].map(r => (
            <div key={r.label} className="report-card">
              <div className="report-card-num" style={{ background: `linear-gradient(135deg, ${r.color}, ${r.color}88)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                {r.value}
              </div>
              <div className="report-card-label">{r.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Work */}
      <Section
        title="العمل"
        color="#3b82f6"
        rows={[
          { label: 'الكل', value: work.length },
          { label: 'معلقة', value: work.filter(t => !t.done).length },
          { label: 'مكتملة', value: work.filter(t => t.done).length },
        ]}
      />
      <SubcatSection title="العمل — تفصيل" tasks={work} color="#3b82f6" />

      {/* Personal */}
      <Section
        title="الشخصي"
        color="#8b5cf6"
        rows={[
          { label: 'الكل', value: personal.length },
          { label: 'معلقة', value: personal.filter(t => !t.done).length },
          { label: 'مكتملة', value: personal.filter(t => t.done).length },
        ]}
      />
      <SubcatSection title="الشخصي — تفصيل" tasks={personal} color="#8b5cf6" />

      {/* Health */}
      {health.length > 0 && (
        <Section
          title="الصحة"
          color="#10b981"
          rows={[
            { label: 'الكل', value: health.length },
            { label: 'معلقة', value: health.filter(t => !t.done).length },
            { label: 'مكتملة', value: health.filter(t => t.done).length },
          ]}
        />
      )}

      {all.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <div className="empty-text">لا توجد بيانات</div>
          <div className="empty-sub">أضف مهام لعرض التقارير</div>
        </div>
      )}
    </div>
  )
}
