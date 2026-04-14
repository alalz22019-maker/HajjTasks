import { useState, useEffect, useCallback } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import TasksPage from './pages/TasksPage'
import NotesPage from './pages/NotesPage'
import UploadPage from './pages/UploadPage'
import ContactsPage from './pages/ContactsPage'
import ReportsPage from './pages/ReportsPage'
import AdminPanel from './pages/AdminPanel'
import Toast from './components/Toast'
import { HARDCODED_API_KEY } from './config'
import { loadData, saveData } from './utils/storage'
import {
  subscribeToTasks, importTasksFromArray, isTasksEmpty,
  subscribeToPendingRequests,
} from './utils/db'

function AppShell() {
  const { firebaseUser, userProfile, logout, isAdmin, isUser, loading } = useAuth()
  const [page, setPage]   = useState('tasks')
  const [tasks, setTasks] = useState([])
  const [apiKey, setApiKey] = useState('')
  const [toast, setToast] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [migrationDone, setMigrationDone] = useState(false)
  
  // 🔴 1. حالة التعهد الأمني
  const [pledgeAccepted, setPledgeAccepted] = useState(true)

  /* ── API key ── */
  useEffect(() => {
    const storedKey = loadData('mytasks_apikey') || ''
    setApiKey(HARDCODED_API_KEY || storedKey)
  }, [])

  // 🔴 2. التحقق من موافقة المستخدم الحالي على التعهد
  useEffect(() => {
    if (userProfile && userProfile.name) {
      const isAccepted = loadData(`pledge_accepted_${userProfile.name}`)
      setPledgeAccepted(!!isAccepted)
    }
  }, [userProfile])

  /* ── Subscribe to Firestore tasks after login ── */
  useEffect(() => {
    if (!userProfile) return
    const unsub = subscribeToTasks(setTasks)
    return unsub
  }, [userProfile])

  /* ── Auto-migrate localStorage tasks on first run (admin only) ── */
  useEffect(() => {
    if (!isAdmin || migrationDone) return
    async function migrate() {
      try {
        const empty = await isTasksEmpty()
        if (empty) {
          const local = loadData('mytasks_tasks') || []
          if (local.length > 0) {
            await importTasksFromArray(local)
            showToast(`✓ تم استيراد ${local.length} مهمة من الجهاز`)
          }
        }
        setMigrationDone(true)
      } catch (e) {
        console.error('Migration error:', e)
        setMigrationDone(true)
      }
    }
    migrate()
  }, [isAdmin, migrationDone])

  /* ── Subscribe to pending requests (admin) ── */
  useEffect(() => {
    if (!isAdmin) return
    const unsub = subscribeToPendingRequests(reqs => {
      setPendingCount(reqs.filter(r => r.status === 'pending').length)
    })
    return unsub
  }, [isAdmin])

  const persistApiKey = useCallback((key) => {
    setApiKey(key)
    saveData('mytasks_apikey', key)
  }, [])

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }, [])

  // 🔴 3. دالة الموافقة على التعهد وحفظه في الجهاز
  const handleAcceptPledge = () => {
    saveData(`pledge_accepted_${userProfile.name}`, true)
    setPledgeAccepted(true)
  }

  const contacts = deriveContacts(tasks)

  /* ── Loading splash ── */
  if (loading) {
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        background: 'var(--bg)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32,
        }}>✓</div>
        <span className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    )
  }

  /* ── Login gate ── */
  if (!firebaseUser || !userProfile) {
    return <LoginPage />
  }

  // 🔴 4. شاشة التعهد الأمني الإلزامية (تظهر قبل الدخول للتطبيق)  // 🔴 4. شاشة التعهد الأمني الإلزامية (النسخة الرسمية التوجيهية المعتمدة)
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
            تنبيه أمني
          </h2>
          <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.8, marginBottom: 28, fontWeight: 500 }}>
            تحذير: هذا النظام مخصص لإدارة المهام الإدارية. تجنب إدخال أي بيانات طبية حساسة أو معلومات او بيانات سرية وكذلك بيانات مستفيدين او موظفين التزاماً بسياسات الخصوصية.
          </p>
          <button
            onClick={handleAcceptPledge}
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '12px 24px', fontSize: 15, fontWeight: 700,
              width: '100%', cursor: 'pointer', marginBottom: 12
            }}
          >
            أوافق وأتعهد
          </button>
          <button
            onClick={logout}
            style={{
              background: 'transparent', color: 'var(--text3)',
              border: 'none', borderRadius: 10,
              padding: '10px 24px', fontSize: 14, fontWeight: 600,
              width: '100%', cursor: 'pointer'
            }}
          >
            تراجع وتسجيل الخروج
          </button>
        </div>
      </div>
    )
  }


  /* ── Build nav ── */
  const NAV = [
    { id: 'tasks',   label: 'المهام',  icon: '✓'  },
    { id: 'notes',   label: 'ملاحظة', icon: '✍'  },
    ...(!isUser ? [{ id: 'upload',  label: 'رفع ملف', icon: '📎' }] : []), // تظهر فقط للمدير والمشرف
    { id: 'contacts',label: 'جهات',   icon: '👥' },
        ...(isAdmin ? [{ id: 'reports', label: 'تقرير',  icon: '📊' }] : []),
    ...(isAdmin ? [{ id: 'admin', label: 'إدارة', icon: '⚙️', badge: pendingCount }] : []),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {toast && <Toast msg={toast} />}

      {/* User bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px 6px',
        paddingTop: `max(8px, env(safe-area-inset-top, 8px))`,
        background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
        fontSize: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {userProfile.photoURL && (
            <img src={userProfile.photoURL} alt=""
              style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} />
          )}
          <div>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{userProfile.name}</span>
            <span style={{
              marginRight: 6, fontSize: 10, padding: '2px 7px', borderRadius: 8,
              background: ROLE_BG[userProfile.role] || 'var(--bg3)',
              color: ROLE_COLOR[userProfile.role] || 'var(--text2)',
              fontWeight: 700,
            }}>{ROLE_LABEL[userProfile.role]}</span>
          </div>
        </div>
        <button onClick={logout} style={{
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '4px 10px',
          color: 'var(--text2)', fontSize: 11, fontWeight: 600,
        }}>خروج</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {page === 'tasks' && (
          <TasksPage
            tasks={tasks}
            apiKey={apiKey}
            setApiKey={persistApiKey}
            showToast={showToast}
            userProfile={userProfile}
          />
        )}
        {page === 'notes' && (
          <NotesPage
            tasks={tasks}
            apiKey={apiKey}
            setApiKey={persistApiKey}
            showToast={showToast}
          />
        )}
        {/* حماية إضافية: لو حاول يفتحها بطريقة ما، ما راح تفتح له إذا كان موظف */}
        {page === 'upload' && !isUser && (
          <UploadPage
            tasks={tasks}
            apiKey={apiKey}
            setApiKey={persistApiKey}
            showToast={showToast}
          />
        )}
        {page === 'contacts' && (
          <ContactsPage contacts={contacts} tasks={tasks} showToast={showToast} />
        )}
        {page === 'reports' && (
          <ReportsPage tasks={tasks} showToast={showToast} apiKey={apiKey} userProfile={userProfile} />
        )}
        {page === 'admin' && isAdmin && (
          <AdminPanel showToast={showToast} />
        )}
      </div>

      <div className="nav-spacer" />
      <nav className="bottom-nav">
        {NAV.map(n => (
          <button
            key={n.id}
            className={`nav-item${page === n.id ? ' active' : ''}`}
            onClick={() => setPage(n.id)}
            style={{ position: 'relative' }}
          >
            <span style={{ fontSize: 20 }}>{n.icon}</span>
            <span>{n.label}</span>
            {n.badge > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                background: '#ef4444', color: '#fff',
                borderRadius: '50%', width: 16, height: 16,
                fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{n.badge}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}

/* ─── Role display helpers ───────────────────────────────── */
const ROLE_LABEL = { admin: 'مدير', superuser: 'مشرف', user: 'موظف' }
const ROLE_BG    = { admin: 'rgba(139,92,246,0.15)', superuser: 'rgba(59,130,246,0.15)', user: 'rgba(16,185,129,0.12)' }
const ROLE_COLOR = { admin: '#a78bfa', superuser: '#60a5fa', user: '#34d399' }

function deriveContacts(tasks) {
  const map = {}
  tasks.forEach(t => {
    if (t.person && t.person.trim()) {
      const name = t.person.trim()
      if (!map[name]) map[name] = { name, tasks: [] }
      map[name].tasks.push(t)
    }
  })
  return Object.values(map)
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
