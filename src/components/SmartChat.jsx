import { useState, useRef, useEffect } from 'react'
import { callClaudeChat, buildSmartChatSystem } from '../utils/claude'

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

const PRIORITY_LABELS = { urgent: '🔴 عاجل', medium: '🟡 متوسط', low: '🟢 منخفض' }

export default function SmartChat({ tasks, onAddTasks, onClose, apiKey }) {
  const [messages, setMessages]         = useState([])    // {role, text, parsed?}
  const [input, setInput]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [pendingTasks, setPendingTasks] = useState([])    // مهام مقترحة من Claude
  const [skipped, setSkipped]           = useState(new Set()) // ids المتجاهلة
  const historyRef = useRef([])
  const scrollRef  = useRef(null)
  const inputRef   = useRef(null)

  const activeTasks = tasks.filter(t => !t.done)

  // تمرير تلقائي للأسفل
  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading])

  async function send(text) {
    if (!text.trim() || loading) return

    const userMsg = { role: 'user', content: text }
    historyRef.current = [...historyRef.current, userMsg]
    setMessages(prev => [...prev, { role: 'user', text }])
    setInput('')
    setLoading(true)

    try {
      const system = buildSmartChatSystem(activeTasks)
      const raw    = await callClaudeChat(apiKey, system, historyRef.current)
      const clean  = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

      let parsed
      try { parsed = JSON.parse(clean) }
      catch { parsed = { message: clean, tasks: [], questions: [], duplicates: [], ready: false } }

      historyRef.current = [...historyRef.current, { role: 'assistant', content: raw }]
      setMessages(prev => [...prev, { role: 'assistant', text: parsed.message || '...', parsed }])

      // دمج المهام الجديدة مع الموجودة
      if (parsed.tasks?.length) {
        setPendingTasks(prev => {
          const map = Object.fromEntries(prev.map(t => [t.id, t]))
          parsed.tasks.forEach(nt => {
            map[nt.id] = { ...map[nt.id], ...nt }
          })
          return Object.values(map)
        })
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', text: '❌ ' + e.message }])
    } finally {
      setLoading(false)
    }
  }

  function toggleSkip(id) {
    setSkipped(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function resolveDuplicate(taskId, option) {
    if (option === 'تجاهل') {
      setSkipped(prev => new Set([...prev, taskId]))
    } else {
      setSkipped(prev => { const s = new Set(prev); s.delete(taskId); return s })
    }
    const task = pendingTasks.find(t => t.id === taskId)
    if (task && option !== 'تجاهل') {
      send(`بخصوص مهمة "${task.title}": اخترت "${option}"`)
    }
  }

  function handleAddTasks() {
    const toAdd = pendingTasks
      .filter(t => !skipped.has(t.id))
      .map(t => ({
        id: genId(),
        title: t.title,
        priority: t.priority   || 'medium',
        category: t.category   || 'work',
        subcategory: t.subcategory || 'other',
        person:      t.person      || '',
        dueDate:     t.dueDate     || '',
        projectName: t.projectName || '',
        recurrence:  '',
        reminderTime: '',
        done: false,
        createdAt: Date.now(),
      }))
    onAddTasks(toAdd)
    onClose()
  }

  const confirmedCount = pendingTasks.filter(t => !skipped.has(t.id)).length

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--font)',
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: '16px 16px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>💬 محادثة ذكية</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
            {activeTasks.length} مهمة نشطة للمقارنة
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'var(--text2)',
          fontSize: 22, cursor: 'pointer', padding: 4, lineHeight: 1,
        }}>✕</button>
      </div>

      {/* ── Messages ── */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: '16px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>

        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text2)' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              الصق نصاً أو محادثة
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              سيحلل Claude المحتوى ويقترح المهام<br />
              مع كشف التكرار والأسئلة قبل أي إضافة
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const parsed = msg.parsed
          // آخر قائمة مهام تصدر من Claude نعرضها تحت رسالته
          const isLatestAssistant =
            msg.role === 'assistant' &&
            parsed?.tasks?.length > 0 &&
            messages.slice(i + 1).every(m => !m.parsed?.tasks?.length)

          return (
            <div key={i}>
              {/* فقاعة الرسالة */}
              <div style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user' ? 'var(--purple)' : 'var(--card)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text)',
                  fontSize: 14, direction: 'rtl', lineHeight: 1.6,
                }}>
                  {msg.text}
                </div>
              </div>

              {/* بطاقات المهام — نعرضها فقط تحت آخر رسالة من Claude تحتوي مهاماً */}
              {isLatestAssistant && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pendingTasks.map(t => {
                    const dup     = parsed.duplicates?.find(d => d.taskId === t.id)
                    const isOff   = skipped.has(t.id)
                    return (
                      <div key={t.id} style={{
                        background: isOff ? 'rgba(255,255,255,0.03)' : 'var(--card)',
                        border: `1px solid ${dup ? 'var(--orange)' : isOff ? 'var(--border)' : 'rgba(139,92,246,0.3)'}`,
                        borderRadius: 12, padding: '10px 12px',
                        opacity: isOff ? 0.45 : 1,
                        transition: 'opacity .2s',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: 13, fontWeight: 600, color: 'var(--text)',
                              textDecoration: isOff ? 'line-through' : 'none',
                            }}>
                              {t.title}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <span>{PRIORITY_LABELS[t.priority] || '🟡 متوسط'}</span>
                              {t.person      && <span>👤 {t.person}</span>}
                              {t.projectName && <span>📁 {t.projectName}</span>}
                              {t.dueDate     && <span>📅 {t.dueDate}</span>}
                            </div>

                            {/* تحذير التكرار */}
                            {dup && !isOff && (
                              <div style={{
                                marginTop: 7, padding: '7px 9px',
                                background: 'rgba(245,158,11,0.1)',
                                borderRadius: 8, fontSize: 11, color: 'var(--orange)',
                              }}>
                                ⚠️ مشابهة لـ: "{dup.existingTitle}"
                                {dup.reason && <span style={{ opacity: 0.8 }}> — {dup.reason}</span>}
                                <div style={{ marginTop: 5, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                  {(dup.options || ['إضافة كجديدة', 'تجاهل']).map(opt => (
                                    <button key={opt} onClick={() => resolveDuplicate(t.id, opt)} style={{
                                      padding: '3px 9px', borderRadius: 6,
                                      border: '1px solid var(--orange)',
                                      background: 'none', color: 'var(--orange)',
                                      fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                                    }}>{opt}</button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* زر تأكيد / تجاهل */}
                          <button onClick={() => toggleSkip(t.id)} style={{
                            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                            border: `2px solid ${isOff ? 'var(--border)' : 'var(--green)'}`,
                            background: isOff ? 'none' : 'rgba(16,185,129,0.15)',
                            color: isOff ? 'var(--text2)' : 'var(--green)',
                            fontSize: 14, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {isOff ? '○' : '✓'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* أسئلة Claude */}
              {msg.role === 'assistant' && parsed?.questions?.length > 0 && (
                <div style={{
                  marginTop: 8, padding: '10px 12px',
                  background: 'rgba(139,92,246,0.08)',
                  border: '1px solid rgba(139,92,246,0.25)',
                  borderRadius: 12,
                }}>
                  {parsed.questions.map((q, qi) => (
                    <div key={qi} style={{
                      fontSize: 13, color: 'var(--text)', direction: 'rtl',
                      marginBottom: qi < parsed.questions.length - 1 ? 6 : 0,
                    }}>
                      🤔 {q.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '10px 16px', background: 'var(--card)',
              borderRadius: 16, color: 'var(--text2)', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span className="spinner" />
              Claude يحلل...
            </div>
          </div>
        )}
      </div>

      {/* ── زر الإضافة ── */}
      {confirmedCount > 0 && (
        <div style={{ padding: '8px 16px', flexShrink: 0 }}>
          <button onClick={handleAddTasks} style={{
            width: '100%', padding: '13px',
            background: 'linear-gradient(135deg, #006B3F, #28A265)',
            color: '#fff', border: 'none', borderRadius: 14,
            fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            ✅ إضافة {confirmedCount} مهمة
          </button>
        </div>
      )}

      {/* ── حقل الإدخال ── */}
      <div style={{
        padding: '8px 16px 24px',
        borderTop: '1px solid var(--border)',
        display: 'flex', gap: 8, flexShrink: 0,
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
          placeholder="الصق نصاً أو محادثة أو اكتب سؤالاً..."
          rows={2}
          style={{
            flex: 1, padding: '10px 12px',
            background: 'var(--card)', color: 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 12,
            fontSize: 14, fontFamily: 'inherit', direction: 'rtl',
            resize: 'none', outline: 'none', lineHeight: 1.5,
          }}
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading}
          style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0, alignSelf: 'flex-end',
            background: input.trim() && !loading ? 'var(--purple)' : 'var(--card)',
            border: '1px solid var(--border)',
            color: input.trim() && !loading ? '#fff' : 'var(--text2)',
            fontSize: 20, cursor: input.trim() && !loading ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >↑</button>
      </div>
    </div>
  )
}
