import { useState } from 'react'

// conflicts = [{ newTask, existingTask }, ...]
// onResolve(approved) — approved هي المهام التي اختار المستخدم إضافتها
export default function DuplicateConflictModal({ conflicts, onResolve, onCancel }) {
  // القرار الافتراضي: تخطَّ (false) — المستخدم يختار بنشاط الإضافة
  const [decisions, setDecisions] = useState(
    Object.fromEntries(conflicts.map((_, i) => [i, false]))
  )

  function toggle(i, val) {
    setDecisions(prev => ({ ...prev, [i]: val }))
  }

  function confirm() {
    const approved = conflicts
      .filter((_, i) => decisions[i])
      .map(c => c.newTask)
    onResolve(approved)
  }

  const approvedCount = Object.values(decisions).filter(Boolean).length

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-handle" />

        {/* Header */}
        <div style={{ padding: '0 0 14px' }}>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
            ⚠️ تعارض في {conflicts.length} مهمة
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            هذه المهام مشابهة لمهام موجودة — اختر ماذا تفعل بكل واحدة
          </div>
        </div>

        {/* Conflict cards */}
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {conflicts.map((c, i) => (
            <div key={i} style={{
              background: 'var(--bg3)',
              borderRadius: 12,
              overflow: 'hidden',
              border: decisions[i]
                ? '1px solid rgba(16,185,129,0.35)'
                : '1px solid rgba(239,68,68,0.2)',
            }}>
              {/* الموجودة */}
              <div style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
              }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  background: 'rgba(59,130,246,0.15)',
                  color: 'var(--blue-light)',
                  borderRadius: 4,
                  padding: '2px 6px',
                  whiteSpace: 'nowrap',
                  marginTop: 2,
                }}>موجودة</span>
                <span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
                  {c.existingTask.title}
                </span>
              </div>

              {/* التشابه */}
              <div style={{
                textAlign: 'center',
                fontSize: 11,
                color: 'var(--orange)',
                padding: '4px 0',
                background: 'rgba(245,158,11,0.05)',
                letterSpacing: 1,
              }}>≈ مشابهة</div>

              {/* الجديدة */}
              <div style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
              }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  background: 'rgba(16,185,129,0.15)',
                  color: 'var(--green)',
                  borderRadius: 4,
                  padding: '2px 6px',
                  whiteSpace: 'nowrap',
                  marginTop: 2,
                }}>جديدة</span>
                <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
                  {c.newTask.title}
                </span>
              </div>

              {/* الأزرار */}
              <div style={{ display: 'flex' }}>
                <button
                  onClick={() => toggle(i, true)}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    border: 'none',
                    borderLeft: '1px solid var(--border)',
                    background: decisions[i] ? 'rgba(16,185,129,0.15)' : 'transparent',
                    color: decisions[i] ? 'var(--green)' : 'var(--text2)',
                    fontFamily: 'var(--font)',
                    fontSize: 13,
                    fontWeight: decisions[i] ? 700 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  ➕ أضف الجديدة
                </button>
                <button
                  onClick={() => toggle(i, false)}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    border: 'none',
                    background: !decisions[i] ? 'rgba(239,68,68,0.12)' : 'transparent',
                    color: !decisions[i] ? 'var(--red)' : 'var(--text2)',
                    fontFamily: 'var(--font)',
                    fontSize: 13,
                    fontWeight: !decisions[i] ? 700 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  ✕ تخطَّ
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ paddingTop: 14 }}>
          <button
            className="submit-btn"
            onClick={confirm}
            style={{
              background: approvedCount > 0
                ? 'linear-gradient(135deg, var(--blue), var(--purple))'
                : 'var(--bg3)',
              color: approvedCount > 0 ? '#fff' : 'var(--text2)',
            }}
          >
            {approvedCount > 0
              ? `✅ إضافة ${approvedCount} مهمة`
              : 'تخطي الجميع'}
          </button>
          <button className="cancel-btn" onClick={onCancel}>إلغاء</button>
        </div>
      </div>
    </div>
  )
}
