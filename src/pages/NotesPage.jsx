import { useState } from 'react'
import ApiKeyInput from '../components/ApiKeyInput'
import { callClaude, EXTRACT_SYSTEM } from '../utils/claude'
import PullToRefresh from '../components/PullToRefresh'

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export default function NotesPage({ tasks, setTasks, apiKey, setApiKey, showToast }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [extracted, setExtracted] = useState([])
  const [showApiKey, setShowApiKey] = useState(false)

  async function handleAnalyze() {
    if (!text.trim()) return
    if (!apiKey) { setShowApiKey(true); return }
    setLoading(true)
    setExtracted([])
    try {
      const result = await callClaude(apiKey, EXTRACT_SYSTEM, text)
      const parsed = JSON.parse(result)
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
      recurrence: t.recurrence || '',
      reminderTime: '',
    }))
    setTasks([...newTasks, ...tasks])
    setExtracted([])
    setText('')
    showToast(`✅ تمت إضافة ${newTasks.length} مهمة`)
  }

  return (
    <PullToRefresh onRefresh={() => showToast('✓ محدّث')}>
      <div className="header">
        <div className="header-row">
          <div>
            <div className="header-title">✍️ ملاحظة ذكية</div>
            <div className="header-sub">استخراج مهام من النص الحر</div>
          </div>
          <button
            onClick={() => setShowApiKey(true)}
            style={{
              background: apiKey ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
              color: apiKey ? 'var(--green)' : 'var(--orange)',
              border: 'none',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 12,
              fontFamily: 'var(--font)',
              cursor: 'pointer'
            }}
          >
            {apiKey ? '🔑 API' : '⚙️ API'}
          </button>
        </div>
      </div>

      {!apiKey && (
        <div className="api-key-banner">
          ⚠️ أضف مفتاح Claude API لتفعيل الاستخراج الذكي
          <br />
          <button
            onClick={() => setShowApiKey(true)}
            style={{ background: 'none', border: 'none', color: 'var(--orange)', fontWeight: 700, cursor: 'pointer', marginTop: 6, fontFamily: 'var(--font)' }}
          >
            إضافة المفتاح
          </button>
        </div>
      )}

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
            <span className="spinner" /> يحلل Claude النص...
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

      {showApiKey && (
        <ApiKeyInput apiKey={apiKey} setApiKey={setApiKey} onClose={() => setShowApiKey(false)} />
      )}
    </PullToRefresh>
  )
}
