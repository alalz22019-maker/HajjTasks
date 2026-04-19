import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

export default function QuickAddMenu({ onOption, onClose }) {
  const [closing, setClosing] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef(null)
  const transcriptRef = useRef('')
  const closedRef = useRef(false)

  // Kill mic completely
  const killMic = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null
      recognitionRef.current.onend = null
      recognitionRef.current.onerror = null
      try { recognitionRef.current.abort() } catch {}
      recognitionRef.current = null
    }
    setListening(false)
  }, [])

  const doClose = useCallback(() => {
    if (closedRef.current) return
    closedRef.current = true
    killMic()
    setClosing(true)
    setTimeout(onClose, 150)
  }, [onClose, killMic])

  function pick(option) {
    if (option === 'voice') {
      startVoice()
      return
    }
    const closeFn = doClose
    closeFn()
    setTimeout(() => onOption(option), 160)
  }

  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      doClose()
      setTimeout(() => onOption('voice_fallback'), 160)
      return
    }

    const recognition = new SR()
    recognition.lang = 'ar-SA'
    recognition.continuous = true
    recognition.interimResults = true
    recognitionRef.current = recognition
    transcriptRef.current = ''

    recognition.onresult = (e) => {
      let final = ''
      let interim = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' '
        else interim += e.results[i][0].transcript
      }
      const text = (final + interim).trim()
      transcriptRef.current = final.trim() || text
      setTranscript(text)
    }

    recognition.onend = () => {
      // continuous mode: browser may stop unexpectedly, restart if user didn't press stop
      if (recognitionRef.current && !closedRef.current) {
        try { recognitionRef.current.start() } catch {}
        return
      }
      setListening(false)
      recognitionRef.current = null
    }

    recognition.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return // ignore silence
      killMic()
      if (e.error === 'not-allowed') {
        doClose()
        setTimeout(() => onOption('voice_fallback'), 160)
      }
    }

    setListening(true)
    setTranscript('')
    recognition.start()
  }

  function stopVoice() {
    // abort() immediately kills mic and releases the orange indicator
    if (recognitionRef.current) {
      const txt = transcriptRef.current.trim()
      // Remove handlers first to prevent onend from firing
      recognitionRef.current.onresult = null
      recognitionRef.current.onend = null
      recognitionRef.current.onerror = null
      try { recognitionRef.current.abort() } catch {}
      recognitionRef.current = null
      setListening(false)
      
      if (txt && !closedRef.current) {
        closedRef.current = true
        setClosing(true)
        setTimeout(() => {
          onOption('voice_result', txt)
          onClose()
        }, 160)
      }
    }
  }

  // Cleanup on unmount
  useEffect(() => { return killMic }, [killMic])

  const OPTIONS = [
    { id: 'voice',   icon: '🎤', label: 'إدخال صوتي',    color: '#ef4444' },
    { id: 'chat',    icon: '💬', label: 'محادثة ذكية',    color: '#8b5cf6' },
    { id: 'task',    icon: '📝', label: 'مهمة جديدة',     color: '#3b82f6' },
    { id: 'meeting', icon: '📅', label: 'اجتماع جديد',    color: '#f59e0b' },
    { id: 'report',  icon: '📊', label: 'تقرير جديد',     color: '#10b981' },
    { id: 'minutes', icon: '📋', label: 'محضر → مهام',     color: '#6366f1' },
  ]

  return createPortal(
    <div
      onClick={doClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        opacity: closing ? 0 : 1,
        transition: 'opacity 0.15s ease',
        paddingBottom: 90,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        display: 'flex', flexDirection: 'column', gap: 6,
        width: '78%', maxWidth: 260,
        transform: closing ? 'translateY(20px) scale(0.95)' : 'translateY(0) scale(1)',
        transition: 'transform 0.15s ease',
      }}>
        {listening ? (
          <div style={{
            background: 'var(--card)', borderRadius: 16, padding: 20,
            border: '1px solid rgba(239,68,68,0.3)', textAlign: 'center',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', margin: '0 auto 10px',
              background: 'rgba(239,68,68,0.12)', border: '2px solid #ef4444',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, animation: 'pulse 1.5s infinite',
            }}>🎤</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              جاري الاستماع...
            </div>
            {transcript && (
              <div style={{
                fontSize: 13, color: 'var(--text)', marginBottom: 10,
                padding: '8px 10px', background: 'var(--bg3)', borderRadius: 8,
                direction: 'rtl', lineHeight: 1.6, textAlign: 'right',
              }}>{transcript}</div>
            )}
            <button onClick={stopVoice} style={{
              padding: '8px 20px', borderRadius: 8,
              background: '#ef4444', color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>⏹ إيقاف وإرسال</button>
          </div>
        ) : (
          OPTIONS.map((o, i) => (
            <button key={o.id} onClick={() => pick(o.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 14px', borderRadius: 12,
              background: 'var(--card)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right',
              animationDelay: `${i * 40}ms`,
            }}>
              <span style={{
                width: 32, height: 32, borderRadius: 10,
                background: `${o.color}15`, color: o.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0,
              }}>{o.icon}</span>
              <span>{o.label}</span>
            </button>
          ))
        )}
      </div>
    </div>,
    document.body
  )
}
