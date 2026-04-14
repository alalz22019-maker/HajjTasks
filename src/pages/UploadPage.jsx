import { useState, useRef } from 'react'
import { callClaude, EXTRACT_SYSTEM, PDF_MEETING_SYSTEM, isDuplicateTask, findDuplicateTask } from '../utils/claude'
import DuplicateConflictModal from '../components/DuplicateConflictModal'
import PullToRefresh from '../components/PullToRefresh'
import { addTask } from '../utils/db'
import { GoogleGenerativeAI } from "@google/generative-ai"

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

export default function UploadPage({ tasks, apiKey, setApiKey, showToast }) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [extracted, setExtracted] = useState([])
  const [meetingMeta, setMeetingMeta] = useState(null)
  const [uploadConflicts, setUploadConflicts] = useState(null)
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
    setLoading(true)
    setExtracted([])
    setMeetingMeta(null)
    try {
      const geminiKey = import.meta.env.VITE_GEMINI_API_KEY
      if (!geminiKey) throw new Error('مفتاح Gemini API غير موجود في إعدادات Vercel')
      
      const genAI = new GoogleGenerativeAI(geminiKey)
      let content
      let isPdfMeeting = false

      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        const base64 = await new Promise((res, rej) => {
          reader.onload = e => res(e.target.result.split(',')[1])
          reader.onerror = rej
          reader.readAsDataURL(file)
        })
        
        const model = genAI.getGenerativeModel({ 
          model: 'gemini-2.0-flash',
          systemInstruction: UPLOAD_SYSTEM
        })
        
        const result = await model.generateContent([
          { inlineData: { mimeType: file.type, data: base64 } },
          { text: 'استخرج المهام من هذه الصورة' }
        ])
        content = result.response.text()

      } else if (file.type === 'application/pdf') {
        const reader = new FileReader()
        const base64 = await new Promise((res, rej) => {
          reader.onload = e => res(e.target.result.split(',')[1])
          reader.onerror = rej
          reader.readAsDataURL(file)
        })
        isPdfMeeting = true
        
        const model = genAI.getGenerativeModel({ 
          model: 'gemini-2.0-flash',
          systemInstruction: PDF_MEETING_SYSTEM
        })
        
        const result = await model.generateContent([
          { inlineData: { mimeType: 'application/pdf', data: base64 } },
          { text: 'استخرج المهام والتكليفات من هذا المحضر' }
        ])
        content = result.response.text()

      } else {
        const text = await file.text()
        content = await callClaude(apiKey, EXTRACT_SYSTEM, text.slice(0, 4000))
      }
      
      if (isPdfMeeting) {
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
  async function addAll() {
    const unique = [], conflicts = []
    extracted.forEach(t => {
      const existing = findDuplicateTask(t.title, tasks)
      if (existing) conflicts.push({ newTask: t, existingTask: existing })
      else unique.push(t)
    })
    
    if (conflicts.length > 0) { 
      setUploadConflicts({ conflicts, unique, meta: meetingMeta }); 
      return 
    }
    await _commitUploadTasks(unique, [], meetingMeta)
  }

  async function _commitUploadTasks(uniqueTasks, extraApproved, meta) {
    const all = [...uniqueTasks, ...extraApproved]
    let addedCount = 0

    try {
      if (meta) {
        const parentTitle = meta.meetingTitle || 'مهام محضر اجتماع'
        const existingParent = findDuplicateTask(parentTitle, tasks)
        let effectiveParentId = existingParent ? existingParent.id : null

        if (!existingParent) {
          const parentTask = {
            title: parentTitle, priority: 'urgent',
            category: 'work', subcategory: 'leaders',
            person: meta.chairperson || '', dueDate: '',
            recurrence: '', reminderTime: '',
            projectName: meta.suggestedProject || '',
            done: false
          }
          effectiveParentId = await addTask(parentTask) 
          addedCount++
        }

        for (const t of all) {
          await addTask({
            ...t, done: false, subcategory: 'leaders', 
            recurrence: '', reminderTime: '',
            parentId: effectiveParentId, projectName: meta.suggestedProject || ''
          })
          addedCount++
        }
      } else {
        for (const t of all) {
          await addTask({
            ...t, done: false, subcategory: t.subcategory || 'other', 
            recurrence: '', reminderTime: ''
          })
          addedCount++
        }
      }

      if (addedCount === 0) {
        showToast('ℹ️ جميع المهام موجودة مسبقاً')
      } else {
        showToast(`✅ تمت إضافة ${addedCount} مهمة بنجاح`)
      }

    } catch (error) {
      console.error("Upload error:", error)
      showToast('❌ حدث خطأ أثناء الحفظ في قاعدة البيانات')
    } finally {
      setUploadConflicts(null)
      setExtracted([])
      setMeetingMeta(null)
      setFile(null)
      setPreview(null)
    }
  }

  return (
    <PullToRefresh onRefresh={() => showToast('✓ محدّث')}>
      {uploadConflicts && (
        <DuplicateConflictModal
          conflicts={uploadConflicts.conflicts}
          onCancel={() => setUploadConflicts(null)}
          onConfirm={async (approved) => {
            await _commitUploadTasks(uploadConflicts.unique, approved, uploadConflicts.meta)
          }}
        />
      )}

      <div className="header">
        <div className="header-row">
          <div>
            <div className="header-title">📎 رفع ملف</div>
            <div className="header-sub">صور وPDF • استخراج ذكي</div>
          </div>
        </div>
      </div>

      <div className="content" style={{ padding: 15, paddingBottom: 100 }}>
        {!file && (
          <div
            className={`dropzone ${dragging ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
            onClick={() => inputRef.current.click()}
          >
            <div className="drop-icon">📄</div>
            <div style={{ fontWeight: 'bold' }}>اسحب الملف هنا أو اضغط للاختيار</div>
            <div style={{ fontSize: 13, color: 'var(--sub-text)' }}>ندعم الصور وملفات PDF</div>
          </div>
        )}
        <input type="file" ref={inputRef} style={{ display: 'none' }} accept="image/*,application/pdf" onChange={e => handleFile(e.target.files[0])} />

        {file && (
          <div className="preview-container">
            {preview ? (
              <img src={preview} alt="preview" style={{ width: '100%', borderRadius: 12, objectFit: 'contain', maxHeight: 300 }} />
            ) : (
              <div style={{ padding: 40, textAlign: 'center', background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
                📄 {file.name}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setFile(null); setExtracted([]) }} disabled={loading}>إلغاء</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={analyze} disabled={loading}>
                {loading ? '⏳ جاري التحليل...' : '✨ تحليل واستخراج'}
              </button>
            </div>
          </div>
        )}

        {extracted.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h3 style={{ marginBottom: 15, fontSize: 16 }}>المهام المستخرجة ({extracted.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {extracted.map((t, i) => (
                <div key={genId() + i} style={{ background: 'var(--card-bg)', padding: 15, borderRadius: 12, border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 'bold', fontSize: 15 }}>{t.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--sub-text)', marginTop: 5 }}>
                    {t.priority} • {t.person || 'بدون تعيين'} • {t.dueDate || 'بدون تاريخ'}
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} onClick={addAll}>
              📥 إضافة كل المهام ({extracted.length})
            </button>
          </div>
        )}
      </div>
    </PullToRefresh>
  )
}
