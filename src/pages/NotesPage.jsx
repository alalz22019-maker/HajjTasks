import { useState } from 'react'
import { callClaude, EXTRACT_SYSTEM } from '../utils/claude'
import { deduplicateTasks } from '../utils/dedup'
import { addTask as dbAddTask } from '../utils/db'
import PullToRefresh from '../components/PullToRefresh'

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export default function NotesPage({ tasks, apiKey, setApiKey, showToast }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [extracted, setExtracted] = useState([])

  async function handleAnalyze() {
    if (!text.trim()) return
    setLoading(true)
    setExtracted([])
    try {
      const raw = await callClaude(apiKey, EXTRACT_SYSTEM, text)
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
      const parsed = JSON.parse(cleaned)
      setExtracted(Array.isArray(parsed) ? parsed : [])
    } catch (e) {
      showToast('❌ ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function addAll() {
    const allNew = extracted.map(t => ({
      ...t,
      done: false,
      subcategory: t.subcategory || 'other',
      recurrence: t.recurrence || '',
      reminderTime: '',
      taskType: 'task',
    }))
    const newTasks = deduplicateTasks(allNew, tasks)
    const skipped = allNew.length - newTasks.length
    try {
      for (const t of newTasks) await dbAddTask(t)
      setExtracted([])
      setText('')
      if (newTasks.length === 0) {
        showToast('⚠️ جميع المهام موجودة مسبقاً')
      } else {
        showToast(`✅ تمت إضافة ${newTasks.length} مهمة${skipped ? ` (تجاهل ${skipped} مكررة)` : ''}`)
      }
    } catch (e) {
      showToast('❌ خطأ في الإضافة')
    }
  }

  return (
    <PullToRefresh onRefresh={() => showToast('✓ محدّث')}>
      <div className="header">
        <div className="header-row">
          <div>
            <div className="header-title">✍️ ملاحظة ذكية</div>
            <div className="header-sub">استخراج مهام من النص الحر</div>
          </div>
        </div>
      </div>

      <div className="notes-area">
        <div className="form-group">
          <label className="form-label">اكتب ملاحظتك أو محادثتك هنا</label>
          <textarea
            className="form-input"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="مثال: اجتماع مع الدكتور أحمد غداً لمراجعة تقرير المستشفيات، وأرسال ملف الميزانية للمدير عاجلاً..."
            style={{ minHeight: 160 }}
          />
        </div>

        <button
          className="submit-btn"
          onClick={handleAnalyze}
          disabled={!text.trim() || loading}
        >
          {loading ? '⏳ جاري التحليل...' : '🤖 تحليل واستخراج المهام'}
        </button>

        {loading && (
          <div className="loading-text">
            <span className="spinner" /> جاري تحليل النص...
          </div>
        )}

        {extracted.length > 0 && (
          <div className="ai-result" style={{ marginTop: 20 }}>
            <div className="ai-result-title">
              🎯 استُخرجت {extracted.length} مهمة:
            </div>
            {extracted.map((t, i) => (
              <div key={i} className="ai-task-item">
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>
                    {t.priority === 'urgent' ? '🔴 عاجل' : t.priority === 'medium' ? '🟡 متوسط' : '🟢 منخفض'}
                    {t.person ? ` • 👤 ${t.person}` : ''}
                    {t.dueDate ? ` • 📅 ${t.dueDate}` : ''}
                  </div>
                </div>
              </div>
            ))}
            <button className="submit-btn" onClick={addAll} style={{ marginTop: 14 }}>
              ✅ إضافة جميع المهام
            </button>
          </div>
        )}
      </div>
    </PullToRefresh>
  )
}
