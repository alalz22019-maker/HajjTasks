import PullToRefresh from '../components/PullToRefresh'

export default function ContactsPage({ contacts, tasks, showToast }) {
  function shareWhatsApp(name) {
    const personTasks = tasks.filter(t => t.person?.toLowerCase() === name.toLowerCase() && !t.done)
    const msg = encodeURIComponent(
      `مرحباً ${name} 👋\n\nمهامك المعلقة (${personTasks.length}):\n` +
      personTasks.map((t, i) => `${i + 1}. ${t.title}${t.dueDate ? ` (${t.dueDate})` : ''}`).join('\n') +
      '\n\n— علي الزهراني • مهامي Pro'
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  const initial = (name) => {
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return parts[0][0] + parts[1][0]
    return name[0] || '?'
  }

  return (
    <PullToRefresh onRefresh={() => showToast('✓ محدّث')}>
      <div className="header">
        <div className="header-title">👥 جهات الاتصال</div>
        <div className="header-sub">تُضاف تلقائياً من المهام • {contacts.length} جهة</div>
      </div>

      {contacts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <div className="empty-text">لا توجد جهات اتصال</div>
          <div className="empty-sub">أضف أشخاصاً في المهام وستظهر هنا تلقائياً</div>
        </div>
      ) : (
        <div className="contact-list">
          {contacts.map(c => {
            const pending = c.tasks.filter(t => !t.done).length
            const done = c.tasks.filter(t => t.done).length
            return (
              <div key={c.name} className="contact-card">
                <div className="contact-avatar">
                  {initial(c.name)}
                </div>
                <div className="contact-info">
                  <div className="contact-name">{c.name}</div>
                  <div className="contact-tasks">
                    {pending > 0 && <span style={{ color: 'var(--orange)' }}>{pending} معلقة</span>}
                    {pending > 0 && done > 0 && ' • '}
                    {done > 0 && <span style={{ color: 'var(--green)' }}>{done} مكتملة</span>}
                  </div>
                </div>
                <button
                  className="contact-wa"
                  onClick={() => shareWhatsApp(c.name)}
                  title="مشاركة عبر واتساب"
                >
                  💬
                </button>
              </div>
            )
          })}
        </div>
      )}
    </PullToRefresh>
  )
}
