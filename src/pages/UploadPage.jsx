import { useState, useRef } from 'react'
import ApiKeyInput from '../components/ApiKeyInput'
import { callClaude, EXTRACT_SYSTEM } from '../utils/claude'

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

const UPLOAD_SYSTEM = `أنت مساعد ذكي. المستخدم سيرسل صورة أو محتوى ملف.
استخرج المهام والتكليفات منه وأرجعها كـ JSON array بهذا الشكل (بدون أي نص إضافي):
[
  {
    "title": "عنوان المهمة",
    "priority": "urgent|medium|low",
    "category": "work|personal|health",
    "subcategory": "leaders|team|other|home|business",
    "person": "اسم الشخص أو فارغ",
    "dueDate": "YYYY-MM-DD أو فارغ"
  }
]
أرجع JSON فقط.`

export default function UploadPage({ tasks, setTasks, apiKey, setApiKey, showToast }) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [extracted, setExtracted] = useState([])
  const [showApiKey, setShowApiKey] = useState(false)
  const inputRef = useRef()

  function handleFile(f) {
    if (!f) return
    setFile(f)
    setExtracted([])
    if (f.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = e => setPreview(e.target.result)
      reader.readAsDataURL(f)
    } else {
      setPreview(null)
    }
  }

  async function analyze() {
    if (!file) return
    if (!apiKey) { setShowApiKey(true); return }

    setLoading(true)
    setExtracted([])
    try {
      let content

      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        const base64 = await new Promise((res, rej) => {
          reader.onload = e => res(e.target.result.split(',')[1])
          reader.onerror = rej
          reader.readAsDataURL(file)
        })
        const mediaType = file.type

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-opus-4-6',
            max_tokens: 2048,
            system: UPLOAD_SYSTEM,
            messages: [{
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
                { type: 'text', text: 'استخرج المهام من هذه الصورة' }
              ]
            }]
          })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error?.message || `API error ${res.status}`)
        content = data.content?.[0]?.text || '[]'

      } else if (file.type === 'application/pdf') {
        const reader = new FileReader()
        const base64 = await new Promise((res, rej) => {
          reader.onload = e => res(e.target.result.split(',')[1])
          reader.onerror = rej
          reader.readAsDataURL(file)
        })

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'pdfs-2024-09-25',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-opus-4-6',
            max_tokens: 4096,
            system: UPLOAD_SYSTEM,
            messages: [{
              role: 'user',
              content: [
                { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
                { type: 'text', text: 'استخرج المهام والتكليفات من هذا الملف' }
              ]
            }]
          })
        })
        const rawText = await res.text()
        let data
        try { data = JSON.parse(rawText) } catch { throw new Error('خطأ في الاتصال بالـ API: ' + rawText.slice(0, 200)) }
        if (!res.ok) throw new Error(data?.error?.message || `API error ${res.status}`)
        content = data.content?.[0]?.text || '[]'

      } else {
        const text = await file.text()
        content = await callClaude(apiKey, EXTRACT_SYSTEM, text.slice(0, 4000))
      }

      // استخراج JSON array من الرد مهما كان الشكل
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error('لم يتم العثور على مهام في الملف')
      const parsed = JSON.parse(jsonMatch[0])
      setExtracted(Array.isArray(parsed) ? parsed : [])
    } catch (e) {
      showToast('❌ ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  function addAll() {
    const newTasks = extracted.map(t => ({
      ...t,
      id: genId(),
      done: false,
      createdAt: Date.now(),
      subcategory: t.subcategory || 'other',
      recurrence: '',
      reminderTime: '',
    }))
    setTasks([...newTasks, ...tasks])
    setExtracted([])
    setFile(null)
    setPreview(null)
    showToast(`✅ تمت إضافة ${newTasks.length} مهمة`)
  }

  return (
    <div className="page">
      <div className="header">
        <div className="header-row">
          <div>
            <div className="header-title">📎 رفع ملف</div>
            <div className="header-sub">صور وPDF • استخراج ذكي</div>
          </div>
          <button
            onClick={() => setShowApiKey(true)}
            style={{
              background: apiKey ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
              color: apiKey ? 'var(--green)' : 'var(--orange)',
              border: 'none', borderRadius: 8, padding: '6px 10px',
              fontSize: 12, fontFamily: 'var(--font)', cursor: 'pointer'
            }}
          >
            {apiKey ? '🔑 API' : '⚙️ API'}
          </button>
        </div>
      </div>

      {!apiKey && (
        <div className="api-key-banner">
          ⚠️ أضف مفتاح Claude API لتحليل الملفات والصور
          <br />
          <button
            onClick={() => setShowApiKey(true)}
            style={{ background: 'none', border: 'none', color: 'var(--orange)', fontWeight: 700, cursor: 'pointer', marginTop: 6, fontFamily: 'var(--font)' }}
          >
            إضافة المفتاح
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf,.txt"
        style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files[0])}
      />

      {!file ? (
        <div
          className={`upload-zone${dragging ? ' dragging' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
        >
          <div className="upload-icon">📂</div>
          <div className="upload-text">اضغط لرفع ملف</div>
          <div className="upload-sub">صور، PDF، أو ملفات نصية</div>
        </div>
      ) : (
        <div style={{ margin: 16 }}>
          {preview && (
            <img
              src={preview}
              alt="preview"
              style={{ width: '100%', borderRadius: 12, marginBottom: 14, maxHeight: 250, objectFit: 'cover' }}
            />
          )}
          <div style={{ background: 'var(--card)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>📄 {file.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
              {(file.size / 1024).toFixed(1)} KB
            </div>
          </div>

          {loading && (
            <div className="loading-text">
              <span className="spinner" /> يحلل Claude الملف...
            </div>
          )}

          {extracted.length > 0 && (
            <div className="ai-result">
              <div className="ai-result-title">🎯 استُخرجت {extracted.length} مهمة:</div>
              {extracted.map((t, i) => (
                <div key={i} className="ai-task-item">
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{t.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>
                      {t.priority === 'urgent' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢'}
                      {t.person ? ` • 👤 ${t.person}` : ''}
                    </div>
                  </div>
                </div>
              ))}
              <button className="submit-btn" onClick={addAll} style={{ marginTop: 14 }}>
                ✅ إضافة جميع المهام
              </button>
            </div>
          )}

          {!loading && extracted.length === 0 && (
            <button className="submit-btn" onClick={analyze}>
              🤖 تحليل الملف
            </button>
          )}

          <button className="cancel-btn" onClick={() => { setFile(null); setPreview(null); setExtracted([]) }}>
            رفع ملف آخر
          </button>
        </div>
      )}

      {showApiKey && (
        <ApiKeyInput apiKey={apiKey} setApiKey={setApiKey} onClose={() => setShowApiKey(false)} />
      )}
    </div>
  )
}
