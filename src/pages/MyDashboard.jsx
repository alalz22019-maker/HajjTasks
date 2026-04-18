import { useState, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import PullToRefresh from '../components/PullToRefresh'

/* ─── Date helpers ─────────────────────────────── */
const TODAY = (() => { const d = new Date(); d.setHours(0,0,0,0); return d })()
const WEEK_AGO = new Date(TODAY.getTime() - 7 * 86400000)
const WEEK_END = new Date(TODAY.getTime() + 7 * 86400000)

function isToday(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr); d.setHours(0,0,0,0)
  return d.getTime() === TODAY.getTime()
}

function isThisWeek(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr); d.setHours(0,0,0,0)
  return d >= TODAY && d <= WEEK_END
}

function isOverdue(t) {
  if (t.done || !t.dueDate) return false
  const d = new Date(t.dueDate); d.setHours(0,0,0,0)
  return d < TODAY
}

function completedThisWeek(t) {
  if (!t.done || !t.completedAt) return false
  return new Date(t.completedAt) >= WEEK_AGO
}

function completedToday(t) {
  if (!t.done || !t.completedAt) return false
  const c = new Date(t.completedAt)
  const end = new Date(TODAY); end.setHours(23,59,59,999)
  return c >= TODAY && c <= end
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const days = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']
  return `${days[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}`
}

function formatGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'صباح الخير'
  if (h < 17) return 'مساء الخير'
  return 'مساء النور'
}

function getMotivation(weekDone) {
  if (weekDone >= 20) return { text: 'أداء استثنائي هذا الأسبوع!', icon: '🏆' }
  if (weekDone >= 10) return { text: 'ممتاز — استمر على هذا المستوى!', icon: '⭐' }
  if (weekDone >= 5)  return { text: 'بداية جيدة — واصل!', icon: '💪' }
  return { text: 'ابدأ يومك بإنجاز أول مهمة', icon: '🚀' }
}

/* ─── Routine tracking ─────────────────────────── */
function getRoutineStats(tasks) {
  const routines = tasks.filter(t => t.recurrence && t.recurrence !== '')
  const completed = routines.filter(t => t.done).length
  const total = routines.length
  const pct = total ? Math.round((completed / total) * 100) : 0
  return { routines, completed, total, pct }
}

/* ─── Report tasks detection ──────────────────── */
function isReportTask(t) {
  const title = (t.title || '').toLowerCase()
  const keywords = ['تقرير', 'report', 'إحصائية', 'ملخص', 'dashboard', 'بيانات', 'إعداد تقرير', 'تقارير']
  return keywords.some(k => title.includes(k)) || t.taskType === 'report'
}

/* ─── Component ────────────────────────────────── */
export default function MyDashboard({ tasks, showToast, onNavigate }) {
  const { userProfile } = useAuth()
  const userName = userProfile?.name || 'مستخدم'
  const firstName = userName.split(' ').pop() || userName

  const [activeSection, setActiveSection] = useState('overview')

  // Filter tasks for current user
  const myTasks = useMemo(() => 
    tasks.filter(t => t.person && t.person.includes(userName))
  , [tasks, userName])

  const allTasks = tasks // for admin view

  // Stats
  const stats = useMemo(() => {
    const src = myTasks.length > 0 ? myTasks : allTasks
    const total = src.length
    const done = src.filter(t => t.done).length
    const pending = total - done
    const urgent = src.filter(t => t.priority === 'urgent' && !t.done).length
    const overdue = src.filter(isOverdue).length
    const todayDue = src.filter(t => !t.done && isToday(t.dueDate)).length
    const weekDue = src.filter(t => !t.done && isThisWeek(t.dueDate)).length
    const todayDone = src.filter(completedToday).length
    const weekDone = src.filter(completedThisWeek).length
    const pct = total ? Math.round((done / total) * 100) : 0
    return { total, done, pending, urgent, overdue, todayDue, weekDue, todayDone, weekDone, pct }
  }, [myTasks, allTasks])

  const motivation = getMotivation(stats.weekDone)
  const routine = useMemo(() => getRoutineStats(myTasks.length > 0 ? myTasks : allTasks), [myTasks, allTasks])

  // Today's agenda
  const todayAgenda = useMemo(() => {
    const src = myTasks.length > 0 ? myTasks : allTasks
    return src
      .filter(t => !t.done && (isToday(t.dueDate) || (t.priority === 'urgent' && !t.dueDate)))
      .sort((a, b) => {
        if (a.priority === 'urgent' && b.priority !== 'urgent') return -1
        if (b.priority === 'urgent' && a.priority !== 'urgent') return 1
        return 0
      })
      .slice(0, 8)
  }, [myTasks, allTasks])

  // Overdue tasks
  const overdueTasks = useMemo(() => {
    const src = myTasks.length > 0 ? myTasks : allTasks
    return src.filter(isOverdue).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 5)
  }, [myTasks, allTasks])

  // Recent completions
  const recentDone = useMemo(() => {
    const src = myTasks.length > 0 ? myTasks : allTasks
    return src.filter(completedThisWeek)
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .slice(0, 5)
  }, [myTasks, allTasks])

  // Report tasks
  const reportTasks = useMemo(() => {
    const src = myTasks.length > 0 ? myTasks : allTasks
    return src.filter(isReportTask).slice(0, 5)
  }, [myTasks, allTasks])

  // Projects breakdown
  const projects = useMemo(() => {
    const src = myTasks.length > 0 ? myTasks : allTasks
    const map = {}
    src.forEach(t => {
      const p = t.projectName || 'بدون مشروع'
      if (!map[p]) map[p] = { total: 0, done: 0 }
      map[p].total++
      if (t.done) map[p].done++
    })
    return Object.entries(map)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 6)
      .map(([name, v]) => ({ name, ...v, pct: v.total ? Math.round((v.done / v.total) * 100) : 0 }))
  }, [myTasks, allTasks])

  const SECTIONS = [
    { id: 'overview', label: 'نظرة عامة', icon: '📊' },
    { id: 'today',    label: 'اليوم',     icon: '📅' },
    { id: 'routine',  label: 'الروتين',   icon: '🔄' },
    { id: 'reports',  label: 'التقارير',  icon: '📋' },
    { id: 'projects', label: 'المشاريع',  icon: '📁' },
  ]

  return (
    <PullToRefresh onRefresh={() => showToast('✓ محدّث')}>
      <div className="header">
        <div className="header-row">
          <div>
            <div className="header-title" style={{ fontSize: 18 }}>
              {motivation.icon} {formatGreeting()}، {firstName}
            </div>
            <div className="header-sub">{motivation.text}</div>
          </div>
        </div>
      </div>

      <div className="page" style={{ paddingBottom: 90 }}>
        {/* Quick Stats Strip */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
          padding: '12px 16px',
        }}>
          <QuickStat value={stats.todayDue} label="مستحقة اليوم" color="var(--blue)" />
          <QuickStat value={stats.urgent} label="عاجلة" color="var(--red)" />
          <QuickStat value={stats.overdue} label="متأخرة" color="var(--orange)" />
          <QuickStat value={stats.todayDone} label="أنجزت اليوم" color="var(--green)" />
        </div>

        {/* Progress Ring */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '8px 16px 16px', 
        }}>
          <MiniRing pct={stats.pct} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              {stats.done} من {stats.total} مهمة مكتملة
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              {stats.weekDone} إنجاز هذا الأسبوع • {stats.weekDue} مستحقة
            </div>
            <div style={{
              marginTop: 8, height: 6, borderRadius: 3, background: 'var(--bg3)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 3, width: `${stats.pct}%`,
                background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        </div>

        {/* Section Tabs */}
        <div style={{
          display: 'flex', gap: 6, padding: '0 16px 12px',
          overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        }}>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
              padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              whiteSpace: 'nowrap', fontFamily: 'var(--font)', border: 'none',
              background: activeSection === s.id ? 'linear-gradient(135deg,#3b82f6,#8b5cf6)' : 'var(--bg3)',
              color: activeSection === s.id ? '#fff' : 'var(--text2)',
              transition: 'all 0.2s',
            }}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {/* ─── Overview Section ─── */}
        {activeSection === 'overview' && (
          <div style={{ padding: '0 16px' }}>
            {/* Today's Agenda */}
            <SectionHeader icon="📅" title="أجندة اليوم" count={todayAgenda.length} />
            {todayAgenda.length === 0 ? (
              <EmptyState text="لا توجد مهام مستحقة اليوم" icon="✨" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {todayAgenda.map(t => <AgendaItem key={t.id} task={t} />)}
              </div>
            )}

            {/* Overdue */}
            {overdueTasks.length > 0 && (
              <>
                <SectionHeader icon="⚠️" title="متأخرة" count={overdueTasks.length} color="var(--orange)" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {overdueTasks.map(t => <AgendaItem key={t.id} task={t} isOverdue />)}
                </div>
              </>
            )}

            {/* Recent Done */}
            {recentDone.length > 0 && (
              <>
                <SectionHeader icon="✅" title="آخر الإنجازات" count={stats.weekDone} color="var(--green)" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {recentDone.map(t => (
                    <div key={t.id} style={{
                      padding: '10px 14px', borderRadius: 12,
                      background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)',
                    }}>
                      <div style={{ fontSize: 13, color: 'var(--text)', textDecoration: 'line-through', opacity: 0.7 }}>{t.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 4 }}>
                        ✓ {t.completedAt ? new Date(t.completedAt).toLocaleDateString('ar-SA') : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── Today Section ─── */}
        {activeSection === 'today' && (
          <div style={{ padding: '0 16px' }}>
            <SectionHeader icon="🌅" title="جدول اليوم" />
            <div style={{
              background: 'var(--card)', borderRadius: 16, padding: 16,
              border: '1px solid var(--border)', marginBottom: 16,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
                {new Date().toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              {todayAgenda.length === 0 && overdueTasks.length === 0 ? (
                <EmptyState text="يومك فاضي — استثمره في المتأخرات أو التخطيط" icon="☕" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {overdueTasks.map(t => (
                    <TimelineItem key={t.id} task={t} time="متأخرة" color="var(--orange)" icon="⚠️" />
                  ))}
                  {todayAgenda.map(t => (
                    <TimelineItem key={t.id} task={t} 
                      time={t.reminderTime || (t.priority === 'urgent' ? 'أولوية' : 'خلال اليوم')}
                      color={t.priority === 'urgent' ? 'var(--red)' : 'var(--blue)'}
                      icon={t.priority === 'urgent' ? '🔴' : '🔵'} />
                  ))}
                </div>
              )}
            </div>

            {/* Week ahead */}
            <SectionHeader icon="📆" title="هذا الأسبوع" count={stats.weekDue} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {(myTasks.length > 0 ? myTasks : allTasks)
                .filter(t => !t.done && isThisWeek(t.dueDate) && !isToday(t.dueDate))
                .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
                .slice(0, 8)
                .map(t => <AgendaItem key={t.id} task={t} showDate />)}
            </div>
          </div>
        )}

        {/* ─── Routine Section ─── */}
        {activeSection === 'routine' && (
          <div style={{ padding: '0 16px' }}>
            <SectionHeader icon="🔄" title="المهام الروتينية" count={routine.total} />
            
            {/* Routine completion rate */}
            <div style={{
              background: 'var(--card)', borderRadius: 16, padding: 16,
              border: '1px solid var(--border)', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>نسبة الالتزام</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: routine.pct >= 80 ? 'var(--green)' : routine.pct >= 50 ? 'var(--orange)' : 'var(--red)' }}>
                  {routine.pct}%
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--bg3)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  width: `${routine.pct}%`,
                  background: routine.pct >= 80 ? 'var(--green)' : routine.pct >= 50 ? 'var(--orange)' : 'var(--red)',
                  transition: 'width 0.5s',
                }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>
                {routine.completed} من {routine.total} مهمة روتينية مكتملة
              </div>
            </div>

            {/* Routine tasks list */}
            {routine.routines.length === 0 ? (
              <EmptyState text="لا توجد مهام متكررة بعد" icon="🔄" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {routine.routines.map(t => (
                  <div key={t.id} style={{
                    padding: '12px 14px', borderRadius: 12,
                    background: 'var(--card)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 10,
                      background: t.done ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14,
                    }}>
                      {t.done ? '✅' : t.recurrence === 'daily' ? '📆' : t.recurrence === 'weekly' ? '📅' : '🗓'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: 'var(--text)',
                        textDecoration: t.done ? 'line-through' : 'none',
                        opacity: t.done ? 0.6 : 1,
                      }}>{t.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                        {t.recurrence === 'daily' ? 'يومي' : t.recurrence === 'weekly' ? 'أسبوعي' : 'شهري'}
                        {t.dueDate ? ` • ${formatDate(t.dueDate)}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Reports Section ─── */}
        {activeSection === 'reports' && (
          <div style={{ padding: '0 16px' }}>
            <SectionHeader icon="📋" title="التقارير" count={reportTasks.length} />
            
            {reportTasks.length === 0 ? (
              <EmptyState text="لا توجد مهام تقارير" icon="📋" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {reportTasks.map(t => (
                  <div key={t.id} style={{
                    padding: '12px 14px', borderRadius: 12,
                    background: 'var(--card)', border: `1px solid ${t.done ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                          {t.person ? `👤 ${t.person}` : ''}
                          {t.dueDate ? ` • 📅 ${formatDate(t.dueDate)}` : ''}
                        </div>
                      </div>
                      <span style={{
                        padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                        background: t.done ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                        color: t.done ? 'var(--green)' : 'var(--orange)',
                      }}>
                        {t.done ? 'مُسلّم' : 'قيد الإعداد'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Projects Section ─── */}
        {activeSection === 'projects' && (
          <div style={{ padding: '0 16px' }}>
            <SectionHeader icon="📁" title="المشاريع والمبادرات" count={projects.length} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {projects.map(p => (
                <div key={p.name} style={{
                  padding: '14px 16px', borderRadius: 14,
                  background: 'var(--card)', border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p.name}</span>
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      color: p.pct === 100 ? 'var(--green)' : p.pct >= 50 ? 'var(--blue)' : 'var(--orange)',
                    }}>{p.pct}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--bg3)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3, width: `${p.pct}%`,
                      background: p.pct === 100 ? 'var(--green)' : 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                      transition: 'width 0.5s',
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                    {p.done} مكتملة من {p.total}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PullToRefresh>
  )
}

/* ─── Sub-components ──────────────────────────── */

function QuickStat({ value, label, color }) {
  return (
    <div style={{
      background: 'var(--card)', borderRadius: 12, padding: '10px 6px',
      textAlign: 'center', border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function MiniRing({ pct }) {
  const r = 28, c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
      <svg viewBox="0 0 70 70" style={{ width: 64, height: 64 }}>
        <circle cx="35" cy="35" r={r} fill="none" stroke="var(--bg3)" strokeWidth="7" />
        <circle cx="35" cy="35" r={r} fill="none" stroke="url(#dg)" strokeWidth="7"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
        <defs>
          <linearGradient id="dg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{pct}%</span>
      </div>
    </div>
  )
}

function SectionHeader({ icon, title, count, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 0', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: color || 'var(--text)' }}>{title}</span>
      </div>
      {count !== undefined && (
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
          background: 'var(--bg3)', color: 'var(--text2)',
        }}>{count}</span>
      )}
    </div>
  )
}

function EmptyState({ text, icon }) {
  return (
    <div style={{
      textAlign: 'center', padding: '24px 16px', marginBottom: 16,
      background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 13, color: 'var(--text3)' }}>{text}</div>
    </div>
  )
}

function AgendaItem({ task, isOverdue: isOD, showDate }) {
  const pColor = task.priority === 'urgent' ? 'var(--red)' : task.priority === 'medium' ? 'var(--orange)' : 'var(--green)'
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 12,
      background: 'var(--card)',
      borderRight: `3px solid ${isOD ? 'var(--orange)' : pColor}`,
      border: `1px solid ${isOD ? 'rgba(245,158,11,0.2)' : 'var(--border)'}`,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{task.title}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {task.person && <span>👤 {task.person.split('/')[0].trim()}</span>}
        {(showDate && task.dueDate) && <span>📅 {formatDate(task.dueDate)}</span>}
        {task.projectName && <span>📁 {task.projectName}</span>}
      </div>
    </div>
  )
}

function TimelineItem({ task, time, color, icon }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        minWidth: 40,
      }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <div style={{ width: 2, height: 20, background: 'var(--border)' }} />
      </div>
      <div style={{
        flex: 1, padding: '10px 14px', borderRadius: 12,
        background: 'var(--card)', border: `1px solid var(--border)`,
      }}>
        <div style={{ fontSize: 11, color, fontWeight: 600, marginBottom: 4 }}>{time}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{task.title}</div>
        {task.person && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>👤 {task.person.split('/')[0].trim()}</div>}
      </div>
    </div>
  )
}
