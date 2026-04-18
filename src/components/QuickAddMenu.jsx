import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

export default function QuickAddMenu({ onOption, onClose }) {
  const [closing, setClosing] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef(null)
  const finalTranscriptRef = useRef('')
  const closedRef = useRef(false)

  const close = useCallback(() => {
    if (closedRef.current) return
    closedRef.current = true
    // Kill mic immediately
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch {}
      recognitionRef.current = null
    }
    setClosing(true)
    setTimeout(onClose, 180)
  }, [onClose])

  function pick(option) {
    if (option === 'voice') {
      startVoice()
      return
    }
    close()
    setTimeout(() => onOption(option), 200)
  }

  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      close()
      setTimeout(() => onOption('voice_fallback'), 200)
      return
    }

    const recognition = new SR()
    recognition.lang = 'ar-SA'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition
    finalTranscriptRef.current = ''

    recognition.onresult = (e) => {
      let final = ''
      let interim = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript
        else interim += e.results[i][0].transcript
      }
      if (final) finalTranscriptRef.current = final
      setTranscript(final || interim)
    }

    recognition.onend = () => {
      setListening(false)
      const txt = finalTranscriptRef.current.trim()
      recognitionRef.current = null
      if (txt) {
        close()
        setTimeout(() => onOption('voice_result', txt), 200)
      }
    }

    recognition.onerror = (e) => {
      setListening(false)
      recognitionRef.current = null
      if (e.error === 'not-allowed' || e.error === 'no-speech') {
        close()
        if (e.error === 'not-allowed') {
          setTimeout(() => onOption('voice_fallback'), 200)
        }
      }
    }

    setListening(true)
    setTranscript('')
    recognition.start()
  }

  function stopVoice() {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }
  }

  // Cleanup on unmount — kill mic
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort() } catch {}
        recognitionRef.current = null
      }
    }
  }, [])

  const OPTIONS = [
    { id: 'voice',   icon: '🎤', label: 'إدخال صوتي',    color: '#ef4444' },
    { id: 'chat',    icon: '✨', label: 'محادثة ذكية',    color: '#8b5cf6' },
    { id: 'task',    icon: '📝', label: 'مهمة جديدة',     color: '#3b82f6' },
    { id: 'meeting', icon: '📅', label: 'اجتماع جديد',    color: '#f59e0b' },
    { id: 'report',  icon: '📋', label: 'تقرير جديد',     color: '#10b981' },
  ]

  return createPortal(
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        opacity: closing ? 0 : 1,
        transition: 'opacity 0.18s ease',
        paddingBottom: 90,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        display: 'flex', flexDirection: 'column', gap: 6,
        width: '80%', maxWidth: 280,
        transform: closing ? 'translateY(30px)' : 'translateY(0)',
        transition: 'transform 0.18s ease',
      }}>
        {listening ? (
          <div style={{
            background: 'var(--card)', borderRadius: 16, padding: 20,
            border: '1px solid var(--border)', textAlign: 'center',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', margin: '0 auto 12px',
              background: 'rgba(239,68,68,0.15)', border: '2px solid #ef4444',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, animation: 'pulse 1.5s infinite',
            }}>🎤</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              جاري الاستماع...
            </div>
            {transcript && (
              <div style={{
                fontSize: 13, color: 'var(--text2)', marginBottom: 10,
                padding: '6px 10px', background: 'var(--bg)', borderRadius: 8,
                direction: 'rtl', lineHeight: 1.5,
              }}>{transcript}</div>
            )}
            <button onClick={stopVoice} style={{
              padding: '8px 20px', borderRadius: 8,
              background: '#ef4444', color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>⏹ إيقاف</button>
          </div>
        ) : (
          OPTIONS.map(o => (
            <button key={o.id} onClick={() => pick(o.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 12,
              background: 'var(--card)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right',
            }}>
              <span style={{
                width: 30, height: 30, borderRadius: 8,
                background: `${o.color}18`, color: o.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, flexShrink: 0,
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
