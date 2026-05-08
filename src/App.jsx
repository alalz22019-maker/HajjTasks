import { useState, useEffect, useCallback, useMemo } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import TasksPage from './pages/TasksPage'
import HajjReportsPage from './pages/HajjReportsPage'
import Toast from './components/Toast'
import { HARDCODED_API_KEY } from './config'
import { loadData, saveData } from './utils/storage'
import { subscribeToTasks } from './utils/db'

function AppShell() {
  const { firebaseUser, userProfile, logout, loading } = useAuth()
  const [page, setPage] = useState('tasks')
  const [tasks, setTasks] = useState([])
  const [apiKey, setApiKey] = useState('')
  const [toast, setToast] = useState(null)
  const [pledgeAccepted, setPledgeAccepted] = useState(true)

  useEffect(() => {
    const storedKey = loadData('mytasks_apikey') || ''
    setApiKey(HARDCODED_API_KEY || storedKey)
  }, [])

  useEffect(() => {
    if (userProfile && userProfile.name) {
      const isAccepted = loadData(`hajj_pledge_${userProfile.name}`)
      setPledgeAccepted(!!isAccepted)
    }
  }, [userProfile])

  useEffect(() => {
    if (!userProfile) return
    const unsub = subscribeToTasks(setTasks)
    return unsub
  }, [userProfile])

  const persistApiKey = useCallback((key) => {
    setApiKey(key)
    saveData('mytasks_apikey', key)
  }, [])

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }, [])

  const handleAcceptPledge = () => {
    saveData(`hajj_pledge_${userProfile.name}`, true)
    setPledgeAccepted(true)
  }

  // Stats
  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0)
    const myTasks = tasks.filter(t => (t.person || '').trim() === (userProfile?.name || '').trim())
    const overdue = myTasks.filter(t => {
      if (t.done || t.status === 'completed' || !t.dueDate) return false
      const d = new Date(t.dueDate); d.setHours(0,0,0,0)
      return d < today
    })
    const pending = myTasks.filter(t => !t.done && t.status !== 'completed')
    const completed = myTasks.filter(t => t.done || t.status === 'completed')
    return { total: myTasks.length, overdue: overdue.length, pending: pending.length, completed: completed.length }
  }, [tasks, userProfile])

  if (loading) {
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        background: 'var(--bg)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32,
        }}>🕋</div>
        <span className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    )
  }

  if (!firebaseUser || !userProfile) {
    return <LoginPage />
  }

  if (!pledgeAccepted) {
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 24,
        background: 'var(--bg)', textAlign: 'center'
      }}>
        <div style={{
          background: 'var(--card)', padding: '32px 24px', borderRadius: 16,
          border: '1px solid var(--border)', maxWidth: 380, width: '100%',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ color: 'var(--text)', marginBottom: 16, fontSize: 18, fontWeight: 700 }}>
            تنبيه أمني — أعمال الحج
          </h2>
          <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.8, marginBottom: 28, fontWeight: 500 }}>
            هذا النظام مخصص لإدارة أعمال الحج. تجنب إدخال أي بيانات حساسة أو معلومات سرية التزاماً بسياسات الخصوصية.
          </p>
          <button onClick={handleAcceptPledge} style={{
            background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
            color: '#fff', border: 'none', borderRadius: 10,
            padding: '12px 24px', fontSize: 15, fontWeight: 700,
            width: '100%', cursor: 'pointer', marginBottom: 12
          }}>أوافق وأتعهد</button>
          <button onClick={logout} style={{
            background: 'transparent', color: 'var(--text3)',
            border: 'none', borderRadius: 10,
            padding: '10px 24px', fontSize: 14, fontWeight: 600,
            width: '100%', cursor: 'pointer'
          }}>تراجع وتسجيل الخروج</button>
        </div>
      </div>
    )
  }

  const NAV = [
    { id: 'tasks',   label: 'المهام',   icon: '✓' },
    { id: 'reports', label: 'التقارير', icon: '📋' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {toast && <Toast msg={toast} />}

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px 6px',
        paddingTop: 'max(8px, env(safe-area-inset-top, 8px))',
        background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
        fontSize: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22 }}>🕋</span>
          <div>
            <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 14 }}>أعمال الحج</span>
            <span style={{ color: 'var(--text3)', fontSize: 11, marginRight: 6 }}> | {userProfile.name}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Quick stats */}
          {stats.overdue > 0 && (
            <span style={{
              background: 'rgba(239,68,68,0.15)', color: '#ef4444',
              padding: '3px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
            }}>{stats.overdue} متأخر</span>
          )}
          <span style={{
            background: 'rgba(59,130,246,0.1)', color: 'var(--blue)',
            padding: '3px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600,
          }}>{stats.pending} متبقي</span>
          <button onClick={logout} style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '4px 10px',
            color: 'var(--text2)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>خروج</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {page === 'tasks' && (
          <TasksPage
            tasks={tasks}
            apiKey={apiKey}
            setApiKey={persistApiKey}
            showToast={showToast}
            userProfile={userProfile}
            onNavigate={setPage}
            onRequestUpdate={null}
          />
        )}
        {page === 'reports' && (
          <HajjReportsPage />
        )}
      </div>

      {/* Bottom nav */}
      <div className="nav-spacer" />
      <nav className="bottom-nav">
        {NAV.map(n => (
          <button key={n.id}
            className={`nav-item${page === n.id ? ' active' : ''}`}
            onClick={() => setPage(n.id)}
          >
            <span style={{ fontSize: 20 }}>{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
