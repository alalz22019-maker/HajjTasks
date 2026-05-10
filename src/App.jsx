import { useState, useEffect, useCallback, useMemo } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ROLE_LABEL, ROLE_BG, ROLE_COLOR } from './constants'
import LoginPage from './pages/LoginPage'
import TasksPage from './pages/TasksPage'
import MyDashboard from './pages/MyDashboard'
import HajjReportsPage from './pages/HajjReportsPage'
import ReportsPage from './pages/ReportsPage'
import ContactsPage from './pages/ContactsPage'
import Toast from './components/Toast'
import { HARDCODED_API_KEY } from './config'
import { loadData, saveData } from './utils/storage'
import { subscribeToTasks, subscribeToHajjReports, subscribeToNotifications, markNotificationRead } from './utils/db'
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from './firebase'

function AppShell() {
  const { firebaseUser, userProfile, logout, isAdmin, isSuperUser, loading } = useAuth()
  const [page, setPage] = useState('dashboard')
  const [tasks, setTasks] = useState([])
  const [hajjReports, setHajjReports] = useState([])
  const [notifications, setNotifications] = useState([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [toast, setToast] = useState(null)
  const [pledgeAccepted, setPledgeAccepted] = useState(false)

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
    const unsub2 = subscribeToHajjReports(setHajjReports)
    const unsub3 = subscribeToNotifications(setNotifications)

    // Migration: تحويل التصنيفات القديمة للمسارات الجديدة (مرة وحدة)
    const migrationDone = localStorage.getItem('hajj_migration_v2')
    if (!migrationDone) {
      const MIGRATION = {
        'ميداني': 'مسار جمع البيانات', 'إداري': 'مسار التدريب',
        'لوجستي': 'مسار التذاكر', 'طوارئ': 'مسار جاهزية الكوادر الصحية',
        'التقارير': 'مسار التقارير الدورية', 'لوح البيانات': 'مسار جمع البيانات',
        'غرفة العمليات': 'مسار الفرضيات', 'التذاكر': 'مسار التذاكر',
        'الزيارات الإشرافية': 'مسار تقرير الزيارات الاشرافية',
        'الزيارات الاشرافية': 'مسار تقرير الزيارات الاشرافية',
      }
      getDocs(collection(db, 'tasks')).then(snap => {
        snap.docs.forEach(d => {
          const pName = d.data().projectName || ''
          const parts = pName.split(',').map(s => s.trim()).filter(Boolean)
          let changed = false
          const newParts = parts.map(p => { if (MIGRATION[p]) { changed = true; return MIGRATION[p] } return p })
          if (changed) {
            updateDoc(doc(db, 'tasks', d.id), { projectName: newParts.join(', '), projectNames: newParts })
          }
        })
        localStorage.setItem('hajj_migration_v2', 'done')
      }).catch(() => {})
    }

    return () => { unsub(); unsub2(); unsub3() }
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

  const contacts = useMemo(() => {
    const map = {}
    tasks.forEach(t => {
      if (t.person && t.person.trim()) {
        const name = t.person.trim()
        if (!map[name]) map[name] = { name, tasks: [] }
        map[name].tasks.push(t)
      }
    })
    return Object.values(map)
  }, [tasks])

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
    { id: 'dashboard', label: 'لوحتي',     icon: '🏠' },
    { id: 'tasks',     label: 'المهام',     icon: '✓' },
    { id: 'hajjreports', label: 'التقارير', icon: '📋' },
    { id: 'stats',     label: 'إحصائيات',   icon: '📊' },
    { id: 'contacts',  label: 'جهات',       icon: '👥' },
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
          {userProfile.photoURL && (
            <img src={userProfile.photoURL} alt=""
              style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} />
          )}
          <div>
            <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 14 }}>🕋 أعمال الحج</span>
            <span style={{ color: 'var(--text3)', fontSize: 11, marginRight: 6 }}> | {userProfile.name}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 🔔 Notification bell */}
          {(() => {
            const myNotifs = notifications.filter(n => n.to === userProfile.name && !n.read)
            return (
              <button onClick={() => setShowNotifs(!showNotifs)} style={{
                background: myNotifs.length > 0 ? 'rgba(239,68,68,0.15)' : 'var(--bg3)',
                border: '1px solid var(--border)', borderRadius: 8,
                padding: '4px 8px', cursor: 'pointer', position: 'relative',
                fontSize: 16,
              }}>
                🔔
                {myNotifs.length > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4,
                    background: '#ef4444', color: '#fff', borderRadius: '50%',
                    width: 16, height: 16, fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{myNotifs.length}</span>
                )}
              </button>
            )
          })()}
          <button onClick={logout} style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '4px 10px',
            color: 'var(--text2)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>خروج</button>
        </div>
      </div>

      {/* Notification panel */}
      {showNotifs && (
        <div style={{
          padding: '12px 16px', background: 'var(--bg2)',
          borderBottom: '1px solid var(--border)', maxHeight: 300, overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>🔔 الإشعارات</span>
            <button onClick={() => setShowNotifs(false)} style={{
              background: 'none', border: 'none', color: 'var(--text3)', fontSize: 18, cursor: 'pointer',
            }}>✕</button>
          </div>
          {(() => {
            const myNotifs = notifications.filter(n => n.to === userProfile.name)
            if (myNotifs.length === 0) return <p style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center' }}>لا توجد إشعارات</p>
            return myNotifs.slice(0, 20).map(n => (
              <div key={n.id} onClick={async () => { if (!n.read) await markNotificationRead(n.id) }} style={{
                padding: '10px 12px', borderRadius: 10, marginBottom: 6,
                background: n.read ? 'var(--bg3)' : 'rgba(59,130,246,0.08)',
                border: `1px solid ${n.read ? 'var(--border)' : 'rgba(59,130,246,0.2)'}`,
                cursor: 'pointer',
              }}>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: n.read ? 400 : 600 }}>{n.message}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
                  من: {n.from} {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
              </div>
            ))
          })()}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {page === 'dashboard' && (
          <MyDashboard
            tasks={tasks}
            hajjReports={hajjReports}
            showToast={showToast}
            onNavigate={setPage}
            updateRequests={[]}
            pendingRequests={0}
          />
        )}
        {page === 'tasks' && (
          <TasksPage
            tasks={tasks}
            setTasks={setTasks}
            apiKey={apiKey}
            setApiKey={persistApiKey}
            showToast={showToast}
            userProfile={userProfile}
            onNavigate={setPage}
            onRequestUpdate={null}
          />
        )}
        {page === 'hajjreports' && (
          <HajjReportsPage />
        )}
        {page === 'stats' && (
          <ReportsPage tasks={tasks} hajjReports={hajjReports} showToast={showToast} apiKey={apiKey} userProfile={userProfile} />
        )}
        {page === 'contacts' && (
          <ContactsPage contacts={contacts} tasks={tasks} showToast={showToast} />
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
