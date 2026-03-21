import { useState, useRef, useEffect } from 'react'

const THRESHOLD = 62   // المسافة اللازمة للتحديث (px)
const MAX_DRAG = 105   // أقصى مسافة سحب

export default function PullToRefresh({ children, onRefresh }) {
  const scrollRef = useRef(null)
  const startY = useRef(0)
  const dragging = useRef(false)
  const busy = useRef(false)
  const curPull = useRef(0)

  const [ty, setTy] = useState(0)           // translateY للصفحة
  const [status, setStatus] = useState('idle') // idle | pulling | ready | refreshing

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    function onTouchStart(e) {
      if (busy.current || el.scrollTop > 1) return
      startY.current = e.touches[0].clientY
      dragging.current = true
    }

    function onTouchMove(e) {
      if (!dragging.current) return
      if (el.scrollTop > 1) {
        dragging.current = false
        curPull.current = 0
        setTy(0)
        setStatus('idle')
        return
      }
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) { curPull.current = 0; setTy(0); return }

      e.preventDefault()
      // تخميد: المقاومة تزيد كلما سحبت أبعد
      const pull = Math.min(dy / (1 + dy / MAX_DRAG), MAX_DRAG)
      curPull.current = pull
      setTy(pull)
      setStatus(pull >= THRESHOLD ? 'ready' : 'pulling')
    }

    function onTouchEnd() {
      if (!dragging.current) return
      dragging.current = false
      if (curPull.current >= THRESHOLD) {
        busy.current = true
        setStatus('refreshing')
        setTy(46) // قفل الـ indicator ظاهر أثناء التحديث
        el.scrollTop = 0  // ارجع للأعلى دائماً عند التحديث
        curPull.current = 0
        Promise.resolve(onRefresh()).finally(() => {
          setTimeout(() => {
            busy.current = false
            setStatus('idle')
            setTy(0)
          }, 550)
        })
      } else {
        curPull.current = 0
        setStatus('idle')
        setTy(0)
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [onRefresh])

  const snap = status === 'idle' || status === 'refreshing'
  const arrowDeg = status === 'ready' ? 180 : Math.min((ty / THRESHOLD) * 168, 168)
  const indOpacity = Math.min(ty / 22, 1)

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Indicator — مطلق، يظهر خلف الصفحة كلما نزلت */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 46,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: snap ? 0 : indOpacity,
          transition: snap ? 'opacity 0.25s ease' : 'none',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        <div style={{
          width: 36, height: 36,
          borderRadius: '50%',
          background: 'var(--card2)',
          border: `1.5px solid ${status === 'ready' ? 'rgba(16,185,129,0.55)' : 'var(--border)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 14px rgba(0,0,0,0.35)',
          transition: 'border-color 0.2s',
        }}>
          {status === 'refreshing' ? (
            <span
              className="spinner"
              style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: 'var(--green)' }}
            />
          ) : (
            <span style={{
              display: 'inline-block',
              fontSize: 15,
              lineHeight: 1,
              transform: `rotate(${arrowDeg}deg)`,
              transition: snap ? 'none' : 'transform 0.18s ease',
              color: status === 'ready' ? 'var(--green)' : 'var(--text2)',
            }}>↓</span>
          )}
        </div>
      </div>

      {/* صفحة — تنزل أثناء السحب وتكشف الـ indicator */}
      <div
        ref={scrollRef}
        className="page"
        style={{
          flex: 1,
          transform: `translateY(${ty}px)`,
          transition: snap ? 'transform 0.32s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none',
          zIndex: 1,
          position: 'relative',
        }}
      >
        {children}
      </div>
    </div>
  )
}
