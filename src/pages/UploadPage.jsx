import { useState, useRef } from 'react'
import ApiKeyInput from '../components/ApiKeyInput'
import { callClaude, EXTRACT_SYSTEM, PDF_MEETING_SYSTEM, isDuplicateTask, findDuplicateTask } from '../utils/claude'
import DuplicateConflictModal from '../components/DuplicateConflictModal'

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
  const [meetingMeta, setMeetingMeta] = useState(null)
  const [uploadConflicts, setUploadConflicts] = useState(null) // { conflicts, unique, meta }
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
    setMeetingMeta(null)
    try {
      let content
      let isPdfMeeting = false

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

        isPdfMeeting = true
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
            system: PDF_MEETING_SYSTEM,
            messages: [{
              role: 'user',
              content: [
                { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
                { type: 'text', text: 'استخرج المهام والتكليفات من هذا المحضر' }
              ]
            }]
          })
        })
        const rawText = await res.text()
        let data
        try { data = JSON.parse(rawText) } catch { throw new Error('خطأ في الاتصال بالـ API: ' + rawText.slice(0, 200)) }
        if (!res.ok) throw new Error(data?.error?.message || `API error ${res.status}`)
        content = data.content?.[0]?.text || '{}'

      } else {
        const text = await file.text()
        content = await callClaude(apiKey, EXTRACT_SYSTEM, text.slice(0, 4000))
      }

      if (isPdfMeeting) {
        // استخراج JSON object من محضر الاجتماع
        const objMatch = content.match(/\{[\s\S]*\}/)
        if (!objMatch) throw new Error('لم يتم العثور على مهام في الملف')
        const parsed = JSON.parse(objMatch[0])
        if (parsed.tasks && Array.isArray(parsed.tasks)) {
          setMeetingMeta({ meetingTitle: parsed.meetingTitle, suggestedProject: parsed.suggestedProject, chairperson: parsed.chairperson })
          setExtracted(parsed.tasks)
        } else {
          throw new Error('تعذّر استخراج المهام من المحضر')
        }
      } else {
        // استخراج JSON array عادي
        const jsonMatch = content.match(/\[[\s\S]*\]/)
        if (!jsonMatch) throw new Error('لم يتم العثور على مهام في الملف')
        const parsed = JSON.parse(jsonMatch[0])
        setExtracted(Array.isArray(parsed) ? parsed : [])
      }
    } catch (e) {
      showToast('❌ ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  function addAll() {
    if (meetingMeta) {
      // فصل مهام المحضر إلى نظيفة ومتعارضة
      const unique = []
      const conflicts = []
      extracted.forEach(t => {
        const existing = findDuplicateTask(t.title, tasks)
        if (existing) conflicts.push({ newTask: t, existingTask: existing })
        else unique.push(t)
      })
      if (conflicts.length > 0) {
        setUploadConflicts({ conflicts, unique, meta: meetingMeta })
        return
      }
      _commitUploadTasks(unique, [], meetingMeta)
    } else {
      const unique = []
      const conflicts = []
      extracted.forEach(t => {
        const existing = findDuplicateTask(t.title, tasks)
        if (existing) conflicts.push({ newTask: t, existingTask: existing })
        else unique.push(t)
      })
      if (conflicts.length > 0) {
        setUploadConflicts({ conflicts, unique, meta: null })
        return
      }
      _commitUploadTasks(unique, [], null)
    }
  }

  function _commitUploadTasks(uniqueTasks, extraApproved, meta) {
    let newTasks
    const all = [...uniqueTasks, ...extraApproved]

    if (meta) {
      const parentTitle = meta.meetingTitle || 'مهام محضر اجتماع'
      const existingParent = findDuplicateTask(parentTitle, tasks)
      const parentId = genId()
      const parentTask = existingParent ? null : {
        id: parentId,
        title: parentTitle,
        priority: 'urgent',
        category: 'work',
        subcategory: 'leaders',
        person: meta.chairperson || '',
        dueDate: '',
        recurrence: '',
        reminderTime: '',
        projectName: meta.suggestedProject || '',
        done: false,
        createdAt: Date.now(),
      }
      const effectiveParentId = existingParent ? existingParent.id : parentId
      const subTasks = all.map(t => ({
        ...t,
        id: genId(),
        done: false,
        createdAt: Date.now(),
        subcategory: 'leaders',
        recurrence: '',
        reminderTime: '',
        parentId: effectiveParentId,
        projectName: meta.suggestedProject || '',
      }))
      newTasks = [...(parentTask ? [parentTask] : []), ...subTasks]
    } else {
      newTasks = all.map(t => ({
        ...t,
        id: genId(),
        done: false,
        createdAt: Date.now(),
        subcategory: t.subcategory || 'other',
        recurrence: '',
        reminderTime: '',
      }))
    }

    if (newTasks.length === 0) {
      showToast('ℹ️ جميع المهام موجودة مسبقاً')
    } else {
      setTasks([...newTasks, ...tasks])
      showToast(`✅ تمت إضافة ${newTasks.length} مهمة`)
    }
    setUploadConflicts(null)
    setExtracted([])
    setMeetingMeta(null)
    setFile(null)
    setPreview(null)
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
              {meetingMeta && (
                <div style={{ background: 'rgba(59,130,246,0.1)', borderRadius: 10, padding: '10px 12px', marginBottom: 12, border: '1px solid rgba(59,130,246,0.2)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue-light)', marginBottom: 4 }}>📋 {meetingMeta.meetingTitle}</div>
                  {meetingMeta.suggestedProject && (
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>📁 {meetingMeta.suggestedProject}</div>
                  )}
                </div>
              )}
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

      {uploadConflicts && (
        <DuplicateConflictModal
          conflicts={uploadConflicts.conflicts}
          onResolve={approved => _commitUploadTasks(uploadConflicts.unique, approved, uploadConflicts.meta)}
          onCancel={() => setUploadConflicts(null)}
        />
      )}
    </div>
  )
}
