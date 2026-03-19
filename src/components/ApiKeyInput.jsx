import { useState } from 'react'

export default function ApiKeyInput({ apiKey, setApiKey, onClose }) {
  const [val, setVal] = useState(apiKey)

  function handleSave() {
    setApiKey(val.trim())
    onClose?.()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <h2 className="modal-title">🔑 مفتاح Claude API</h2>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
          أدخل مفتاح Anthropic API لتفعيل الاستخراج الذكي من النصوص والملفات.
        </p>
        <div className="form-group">
          <label className="form-label">API Key</label>
          <input
            className="form-input"
            type="password"
            value={val}
            onChange={e => setVal(e.target.value)}
            placeholder="sk-ant-..."
            dir="ltr"
          />
        </div>
        <p className="api-key-hint">
          احصل على مفتاحك من console.anthropic.com
        </p>
        <button className="submit-btn" onClick={handleSave} disabled={!val.trim()}>
          حفظ المفتاح
        </button>
        <button className="cancel-btn" onClick={onClose}>إلغاء</button>
      </div>
    </div>
  )
}
