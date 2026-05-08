import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  subscribeToHajjReports, addHajjReport, updateHajjReport, deleteHajjReport,
  subscribeToReportTypes, addReportType, deleteReportType,
} from '../utils/db'
import { DEFAULT_REPORT_TYPES, TEAM_MEMBERS, getEffectiveStatus, STATUS_OPTIONS } from '../constants'

export default function HajjReportsPage() {
  const { currentUser } = useAuth()
  const [reports, setReports] = useState([])
  const [customTypes, setCustomTypes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [showAddType, setShowAddType] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [filter, setFilter] = useState('all') // all | type filter
  const [editingId, setEditingId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [form, setForm] = useState({
    reportType: 'periodic',
    person: '',
    notes: '',
    status: 'not_started',
    dueDate: '',
  })

  useEffect(() => {
    const unsub1 = subscribeToHajjReports(setReports)
    const unsub2 = subscribeToReportTypes(setCustomTypes)
    return () => { unsub1(); unsub2() }
  }, [])

  // Merge default + custom types
  const allTypes = [
    ...DEFAULT_REPORT_TYPES,
    ...customTypes.map(t => ({ value: t.id, label: t.name })),
  ]

  const getTypeName = (val) => {
    const found = allTypes.find(t => t.value === val)
    return found ? found.label : val
  }

  const filtered = filter === 'all'
    ? reports
    : reports.filter(r => r.reportType === filter)

  const resetForm = () => {
    setForm({ reportType: 'periodic', person: '', notes: '', status: 'not_started', dueDate: '' })
    setEditingId(null)
    setShowForm(false)
  }

  const handleSave = async () => {
    if (!form.reportType) return
    const userName = currentUser?.displayName || currentUser?.email || ''
    if (editingId) {
      await updateHajjReport(editingId, { ...form, updatedBy: userName })
    } else {
      await addHajjReport({ ...form, createdBy: userName })
    }
    resetForm()
  }

  const handleEdit = (r) => {
    setForm({
      reportType: r.reportType || 'periodic',
      person: r.person || '',
      notes: r.notes || '',
      status: r.status || 'not_started',
      dueDate: r.dueDate || '',
    })
    setEditingId(r.id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    await deleteHajjReport(id)
    setConfirmDelete(null)
  }

  const handleToggleDone = async (r) => {
    const newStatus = r.status === 'completed' ? 'not_started' : 'completed'
    await updateHajjReport(r.id, {
      status: newStatus,
      ...(newStatus === 'completed' ? { completedAt: new Date().toISOString() } : { completedAt: '' }),
    })
  }

  const handleAddType = async () => {
    if (!newTypeName.trim()) return
    await addReportType({ name: newTypeName.trim() })
    setNewTypeName('')
    setShowAddType(false)
  }

  const handleDeleteType = async (id) => {
    await deleteReportType(id)
  }

  const statusColor = (status) => {
    const s = STATUS_OPTIONS.find(o => o.value === status)
    return s ? s.color : '#6b7280'
  }

  const formatDate = (d) => {
    if (!d) return ''
    return new Date(d).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const containerStyle = {
    padding: '16px', maxWidth: 600, margin: '0 auto',
    fontFamily: 'system-ui, -apple-system, sans-serif', direction: 'rtl',
  }

  const cardStyle = {
    background: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 10,
    border: '1px solid rgba(255,255,255,0.08)',
  }

  const btnStyle = (bg) => ({
    background: bg, color: '#fff', border: 'none', borderRadius: 8,
    padding: '8px 16px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
  })

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)', background: '#0f172a',
    color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box', marginBottom: 10,
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ color: '#e2e8f0', margin: 0, fontSize: 20 }}>📋 التقارير</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowAddType(true)} style={btnStyle('#6366f1')}>+ نوع</button>
          <button onClick={() => { resetForm(); setShowForm(true) }} style={btnStyle('#10b981')}>+ تقرير</button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilter('all')}
          style={{
            ...btnStyle(filter === 'all' ? '#3b82f6' : '#334155'),
            fontSize: 12, padding: '6px 12px',
          }}
        >الكل ({reports.length})</button>
        {allTypes.map(t => {
          const count = reports.filter(r => r.reportType === t.value).length
          return (
            <button key={t.value}
              onClick={() => setFilter(t.value)}
              style={{
                ...btnStyle(filter === t.value ? '#3b82f6' : '#334155'),
                fontSize: 12, padding: '6px 12px',
              }}
            >{t.label} ({count})</button>
          )
        })}
      </div>

      {/* Add type modal */}
      {showAddType && (
        <div style={{ ...cardStyle, background: '#334155', marginBottom: 14 }}>
          <h4 style={{ color: '#e2e8f0', margin: '0 0 10px' }}>إضافة نوع تقرير جديد</h4>
          <input
            placeholder="اسم نوع التقرير..."
            value={newTypeName}
            onChange={e => setNewTypeName(e.target.value)}
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAddType} style={btnStyle('#10b981')}>حفظ</button>
            <button onClick={() => { setShowAddType(false); setNewTypeName('') }} style={btnStyle('#64748b')}>إلغاء</button>
          </div>
          {customTypes.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 6px' }}>الأنواع المضافة:</p>
              {customTypes.map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                  <span style={{ color: '#e2e8f0', fontSize: 13 }}>{t.name}</span>
                  <button onClick={() => handleDeleteType(t.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div style={{ ...cardStyle, background: '#1a2332', border: '1px solid #3b82f6', marginBottom: 14 }}>
          <h4 style={{ color: '#e2e8f0', margin: '0 0 12px' }}>{editingId ? 'تعديل تقرير' : 'إضافة تقرير'}</h4>

          <label style={{ color: '#94a3b8', fontSize: 12 }}>نوع التقرير</label>
          <select value={form.reportType} onChange={e => setForm({ ...form, reportType: e.target.value })} style={inputStyle}>
            {allTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          <label style={{ color: '#94a3b8', fontSize: 12 }}>المسؤول</label>
          <select value={form.person} onChange={e => setForm({ ...form, person: e.target.value })} style={inputStyle}>
            <option value="">— اختر —</option>
            {TEAM_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <label style={{ color: '#94a3b8', fontSize: 12 }}>التاريخ</label>
          <input type="datetime-local" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} style={inputStyle} />

          <label style={{ color: '#94a3b8', fontSize: 12 }}>الحالة</label>
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={inputStyle}>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          <label style={{ color: '#94a3b8', fontSize: 12 }}>ملاحظات</label>
          <textarea
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            rows={3}
            placeholder="ملاحظات اختيارية..."
            style={{ ...inputStyle, resize: 'vertical' }}
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} style={btnStyle('#10b981')}>💾 حفظ</button>
            <button onClick={resetForm} style={btnStyle('#64748b')}>إلغاء</button>
          </div>
        </div>
      )}

      {/* Reports list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>
          لا توجد تقارير {filter !== 'all' ? `من نوع "${getTypeName(filter)}"` : ''}
        </div>
      ) : (
        filtered.map(r => (
          <div key={r.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    background: statusColor(r.status),
                    color: '#fff', borderRadius: 6, padding: '2px 8px',
                    fontSize: 11, fontWeight: 600,
                  }}>
                    {STATUS_OPTIONS.find(s => s.value === r.status)?.label || 'لم يبدأ'}
                  </span>
                  <span style={{
                    background: 'rgba(99,102,241,0.2)',
                    color: '#a5b4fc', borderRadius: 6, padding: '2px 8px',
                    fontSize: 11,
                  }}>{getTypeName(r.reportType)}</span>
                </div>

                {r.person && (
                  <p style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0' }}>👤 {r.person}</p>
                )}
                {r.dueDate && (
                  <p style={{ color: '#64748b', fontSize: 12, margin: '2px 0' }}>🕐 {formatDate(r.dueDate)}</p>
                )}
                {r.notes && (
                  <p style={{ color: '#cbd5e1', fontSize: 13, margin: '6px 0 0', lineHeight: 1.5 }}>{r.notes}</p>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => handleToggleDone(r)} style={{
                  background: r.status === 'completed' ? '#10b981' : '#334155',
                  border: 'none', borderRadius: 8, width: 32, height: 32,
                  color: '#fff', cursor: 'pointer', fontSize: 16,
                }}>✓</button>
                <button onClick={() => handleEdit(r)} style={{
                  background: '#334155', border: 'none', borderRadius: 8,
                  width: 32, height: 32, color: '#f59e0b', cursor: 'pointer', fontSize: 14,
                }}>✏️</button>
                {confirmDelete === r.id ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleDelete(r.id)} style={{ ...btnStyle('#ef4444'), padding: '4px 8px', fontSize: 12 }}>تأكيد</button>
                    <button onClick={() => setConfirmDelete(null)} style={{ ...btnStyle('#64748b'), padding: '4px 8px', fontSize: 12 }}>لا</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(r.id)} style={{
                    background: '#334155', border: 'none', borderRadius: 8,
                    width: 32, height: 32, color: '#ef4444', cursor: 'pointer', fontSize: 14,
                  }}>🗑</button>
                )}
              </div>
            </div>
          </div>
        ))
      )}

      {/* Stats */}
      <div style={{
        background: '#0f172a', borderRadius: 12, padding: 14, marginTop: 16,
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0, textAlign: 'center' }}>
          📊 إجمالي: {reports.length} | مكتمل: {reports.filter(r => r.status === 'completed').length} | متبقي: {reports.filter(r => r.status !== 'completed').length}
        </p>
      </div>
    </div>
  )
}
