import { useState } from 'react'

// conflicts = [{ newTask, existingTask }, ...]
// onResolve(approved) — approved هي المهام التي اختار المستخدم إضافتها
export default function DuplicateConflictModal({ conflicts, onResolve, onCancel }) {
  // null = لم يُقرر بعد، true = إضافة، false = تخطي
  const [decisions, setDecisions] = useState(
    Object.fromEntries(conflicts.map((_, i) => [i, null]))
  )

  function decide(i, val) {
    setDecisions(prev => ({ ...prev, [i]: val }))
  }

  function skipAll() {
    onResolve([])
  }

  function addAll() {
    onResolve(conflicts.map(c => c.newTask))
  }

  function confirm() {
    const approved = conflicts
      .filter((_, i) => decisions[i] === true)
      .map(c => c.newTask)
    onResolve(approved)
  }

  const pendingCount   = Object.values(decisions).filter(v => v === null).length
  const approvedCount  = Object.values(decisions).filter(v => v === true).length
  const allDecided     = pendingCount === 0

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: 0 }}
      >
        <div className="modal-handle" />

        {/* Header */}
        <div style={{ padding: '0 0 12px' }}>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
            ⚠️ تعارض في {conflicts.length} مهمة
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            اختر لكل مهمة: إضافة أو تخطي
          </div>
        </div>

        {/* Conflict cards */}
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {conflicts.map((c, i) => {
            const d = decisions[i]
            return (
              <div key={i} style={{
                borderRadius: 14,
                overflow: 'hidden',
                border: d === true
                  ? '1.5px solid rgba(16,185,129,0.5)'
                  : d === false
                    ? '1.5px solid rgba(239,68,68,0.35)'
                    : '1.5px solid var(--border)',
                background: 'var(--bg3)',
              }}>
                {/* عنوان المهمة الجديدة */}
                <div style={{ padding: '12px 14px 8px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.55 }}>
                    {c.newTask.title}
                  </div>
                  {/* المهمة الموجودة كمرجع */}
                  <div style={{
                    marginTop: 6,
                    fontSize: 11,
                    color: 'var(--text2)',
                    display: 'flex',
                    gap: 5,
                    alignItems: 'flex-start',
                  }}>
                    <span style={{
                      background: 'rgba(59,130,246,0.15)',
                      color: 'var(--blue-light)',
                      borderRadius: 4,
                      padding: '1px 5px',
                      fontSize: 10,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      marginTop: 1,
                    }}>موجودة</span>
                    <span style={{ lineHeight: 1.45 }}>{c.existingTask.title}</span>
                  </div>
                </div>

                {/* أزرار الاختيار */}
                <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
                  <button
                    onClick={() => decide(i, true)}
                    style={{
                      flex: 1,
                      padding: '13px 8px',
                      border: 'none',
                      borderLeft: '1px solid var(--border)',
                      background: d === true ? 'rgba(16,185,129,0.18)' : 'transparent',
                      color: d === true ? 'var(--green)' : 'var(--text2)',
                      fontFamily: 'var(--font)',
                      fontSize: 14,
                      fontWeight: d === true ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {d === true ? '✓ إضافة' : '+ إضافة'}
                  </button>
                  <button
                    onClick={() => decide(i, false)}
                    style={{
                      flex: 1,
                      padding: '13px 8px',
                      border: 'none',
                      background: d === false ? 'rgba(239,68,68,0.15)' : 'transparent',
                      color: d === false ? 'var(--red)' : 'var(--text2)',
                      fontFamily: 'var(--font)',
                      fontSize: 14,
                      fontWeight: d === false ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {d === false ? '✕ تخطي' : '– تخطي'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* زر التأكيد — يظهر فقط بعد اتخاذ قرار بالإضافة */}
          {allDecided && (
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
              {approvedCount > 0 ? `✅ إضافة ${approvedCount} مهمة` : '✓ تم — لا إضافة'}
            </button>
          )}

          {/* إضافة الجميع / تخطي الجميع */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={addAll}
              style={{
                flex: 1,
                padding: '12px',
                border: '1.5px solid rgba(16,185,129,0.45)',
                borderRadius: 12,
                background: 'rgba(16,185,129,0.1)',
                color: 'var(--green)',
                fontFamily: 'var(--font)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ✅ إضافة الجميع
            </button>
            <button
              onClick={skipAll}
              style={{
                flex: 1,
                padding: '12px',
                border: '1.5px solid var(--border)',
                borderRadius: 12,
                background: 'transparent',
                color: 'var(--text2)',
                fontFamily: 'var(--font)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ⏭ تخطي الجميع
            </button>
          </div>

          <button className="cancel-btn" onClick={onCancel}>إلغاء</button>
        </div>
      </div>
    </div>
  )
}
