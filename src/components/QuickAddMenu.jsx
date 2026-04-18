import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function QuickAddMenu({ onOption, onClose }) {
  const [closing, setClosing] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef(null)

  function close() {
    setClosing(true)
    setTimeout(onClose, 200)
  }

  function pick(option) {
    if (option === 'voice') {
      startVoice()
      return
    }
    close()
    onOption(option)
  }

  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      onOption('voice_fallback')
      close()
      return
    }
    const recognition = new SR()
    recognition.lang = 'ar-SA'
    recognition.continuous = false
    recognition.interimResults = true
    recognitionRef.current = recognition

    recognition.onresult = (e) => {
      let final = ''
      let interim = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript
        else interim += e.results[i][0].transcript
      }
      setTranscript(final || interim)
    }

    recognition.onend = () => {
      setListening(false)
      // If we have transcript, pass it
      const txt = transcript || ''
      if (txt.trim()) {
        close()
        onOption('voice_result', txt.trim())
      }
    }

    recognition.onerror = (e) => {
      console.error('Speech error:', e.error)
      setListening(false)
      if (e.error === 'not-allowed') {
        onOption('voice_fallback')
        close()
      }
    }

    setListening(true)
    setTranscript('')
    recognition.start()
  }

  function stopVoice() {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }

  // Handle transcript change after listening ends
  const lastTranscript = useRef('')
  useEffect(() => {
    lastTranscript.current = transcript
  }, [transcript])

  useEffect(() => {
    if (recognitionRef.current) {
      const orig = recognitionRef.current.onend
      recognitionRef.current.onend = () => {
        setListening(false)
        const txt = lastTranscript.current
        if (txt && txt.trim()) {
          close()
          onOption('voice_result', txt.trim())
        }
      }
    }
  })

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort()
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
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: closing ? 'fadeOut 0.2s ease' : 'fadeIn 0.2s ease',
        paddingBottom: 100,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        padding: 16, width: '85%', maxWidth: 320,
        animation: closing ? 'slideDown 0.2s ease' : 'slideUp 0.3s ease',
      }}>
        {listening ? (
          <div style={{
            background: 'var(--card)', borderRadius: 16, padding: 24,
            border: '1px solid var(--border)', textAlign: 'center',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
              background: 'rgba(239,68,68,0.15)', border: '2px solid #ef4444',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, animation: 'pulse 1.5s infinite',
            }}>🎤</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              جاري الاستماع...
            </div>
            {transcript && (
              <div style={{
                fontSize: 14, color: 'var(--text2)', marginBottom: 12,
                padding: '8px 12px', background: 'var(--bg)', borderRadius: 10,
                direction: 'rtl', lineHeight: 1.6, minHeight: 40,
              }}>{transcript}</div>
            )}
            <button onClick={stopVoice} style={{
              padding: '10px 24px', borderRadius: 10,
              background: '#ef4444', color: '#fff', border: 'none',
              fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>⏹ إيقاف</button>
          </div>
        ) : (
          OPTIONS.map(o => (
            <button key={o.id} onClick={() => pick(o.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 14,
              background: 'var(--card)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 15, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right',
              transition: 'transform 0.1s',
            }}>
              <span style={{
                width: 40, height: 40, borderRadius: 12,
                background: `${o.color}20`, color: o.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, flexShrink: 0,
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
