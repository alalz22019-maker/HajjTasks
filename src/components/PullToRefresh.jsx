import { useState, useRef, useEffect, useCallback } from 'react'

const THRESHOLD = 62
const MAX_DRAG  = 105

export default function PullToRefresh({ children, onRefresh }) {
  const scrollRef   = useRef(null)
  const contentRef  = useRef(null)
  const indicatorRef = useRef(null)
  const arrowRef    = useRef(null)

  // Internal gesture refs — never cause React renders
  const startY   = useRef(0)
  const dragging = useRef(false)
  const busy     = useRef(false)
  const curPull  = useRef(0)
  const rafId    = useRef(null)

  // Only ONE piece of React state — triggers render only on touchEnd
  const [refreshing, setRefreshing] = useState(false)

  // Direct DOM helpers (zero React renders)
  const setContentY = useCallback((y, animate) => {
    const el = contentRef.current
    if (!el) return
    el.style.transition = animate ? 'transform 0.32s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none'
    el.style.transform  = `translateY(${y}px)`
  }, [])

  const setIndicator = useCallback((pull) => {
    const ind = indicatorRef.current
    if (!ind) return
    ind.style.opacity = String(Math.min(pull / 22, 1))
    const deg = pull >= THRESHOLD ? 180 : Math.min((pull / THRESHOLD) * 168, 168)
    if (arrowRef.current) {
      arrowRef.current.style.transform = `rotate(${deg}deg)`
    }
    // Green border when past threshold
    const circle = ind.firstChild
    if (circle) {
      circle.style.borderColor = pull >= THRESHOLD
        ? 'rgba(16,185,129,0.55)'
        : 'var(--border)'
    }
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    function onTouchStart(e) {
      if (busy.current || el.scrollTop > 1) return
      startY.current = e.touches[0].clientY
      dragging.current = true
      // Remove transition so drag is instant
      setContentY(0, false)
      if (indicatorRef.current) indicatorRef.current.style.opacity = '0'
    }

    function onTouchMove(e) {
      if (!dragging.current) return
      if (el.scrollTop > 1) {
        dragging.current = false
        curPull.current = 0
        return
      }
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) {
        curPull.current = 0
        return
      }

      // Must preventDefault to stop native scroll during pull gesture
      e.preventDefault()

      // Throttle to one DOM write per animation frame
      if (rafId.current) return
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null
        const pull = Math.min(dy / (1 + dy / MAX_DRAG), MAX_DRAG)
        curPull.current = pull
        setContentY(pull, false)
        setIndicator(pull)
      })
    }

    function onTouchEnd() {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current)
        rafId.current = null
      }
      if (!dragging.current) return
      dragging.current = false

      if (curPull.current >= THRESHOLD) {
        busy.current = true
        // Lock indicator visible at 46px
        setContentY(46, true)
        if (indicatorRef.current) indicatorRef.current.style.opacity = '1'
        curPull.current = 0
        el.scrollTop = 0
        setRefreshing(true)
        Promise.resolve(onRefresh()).finally(() => {
          setTimeout(() => {
            busy.current = false
            setRefreshing(false)
            setContentY(0, true)
            if (indicatorRef.current) indicatorRef.current.style.opacity = '0'
          }, 550)
        })
      } else {
        curPull.current = 0
        setContentY(0, true)
        if (indicatorRef.current) indicatorRef.current.style.opacity = '0'
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })
    el.addEventListener('touchend',   onTouchEnd,   { passive: true })
    el.addEventListener('touchcancel',onTouchEnd,   { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove',  onTouchMove)
      el.removeEventListener('touchend',   onTouchEnd)
      el.removeEventListener('touchcancel',onTouchEnd)
    }
  }, [onRefresh, setContentY, setIndicator])

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Indicator — behind the page */}
      <div
        ref={indicatorRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 46,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        <div style={{
          width: 36, height: 36,
          borderRadius: '50%',
          background: 'var(--card2)',
          border: '1.5px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 14px rgba(0,0,0,0.35)',
          transition: 'border-color 0.2s',
        }}>
          {refreshing ? (
            <span
              className="spinner"
              style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: 'var(--green)' }}
            />
          ) : (
            <span
              ref={arrowRef}
              style={{
                display: 'inline-block',
                fontSize: 15,
                lineHeight: 1,
                color: 'var(--text2)',
              }}
            >↓</span>
          )}
        </div>
      </div>

      {/* Scrollable page — translateY written directly via DOM */}
      <div
        ref={el => { scrollRef.current = el; contentRef.current = el }}
        className="page"
        style={{ flex: 1, zIndex: 1, position: 'relative' }}
      >
        {children}
      </div>
    </div>
  )
}
