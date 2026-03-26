import { useState, useEffect, useCallback } from 'react'
import TasksPage from './pages/TasksPage'
import NotesPage from './pages/NotesPage'
import UploadPage from './pages/UploadPage'
import ContactsPage from './pages/ContactsPage'
import ReportsPage from './pages/ReportsPage'
import { loadData, saveData } from './utils/storage'
import { deduplicateTasks } from './utils/dedup'
import Toast from './components/Toast'
import { HARDCODED_API_KEY } from './config'

const NAV = [
  { id: 'tasks', label: 'المهام', icon: '✓' },
  { id: 'notes', label: 'ملاحظة', icon: '✍' },
  { id: 'upload', label: 'رفع ملف', icon: '📎' },
  { id: 'contacts', label: 'جهات', icon: '👥' },
  { id: 'reports', label: 'تقرير', icon: '📊' },
]

function App() {
  const [page, setPage] = useState('tasks')
  const [tasks, setTasks] = useState([])
  const [apiKey, setApiKey] = useState('')
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const storedTasks = loadData('mytasks_tasks') || []
    const storedKey = loadData('mytasks_apikey') || ''
    const key = HARDCODED_API_KEY || storedKey
    // One-time deduplicate: keep first occurrence of each title
    const unique = storedTasks.filter((t, i, arr) =>
      arr.findIndex(x => x.title.trim().toLowerCase() === t.title.trim().toLowerCase()) === i
    )
    if (unique.length !== storedTasks.length) {
      saveData('mytasks_tasks', unique)
    }
    setTasks(unique)
    setApiKey(key)
  }, [])

  const persistTasks = useCallback((newTasks) => {
    setTasks(newTasks)
    saveData('mytasks_tasks', newTasks)
  }, [])

  const persistApiKey = useCallback((key) => {
    setApiKey(key)
    saveData('mytasks_apikey', key)
  }, [])

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }, [])

  const contacts = deriveContacts(tasks)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {toast && <Toast msg={toast} />}

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {page === 'tasks' && (
          <TasksPage
            tasks={tasks}
            setTasks={persistTasks}
            apiKey={apiKey}
            setApiKey={persistApiKey}
            showToast={showToast}
          />
        )}
        {page === 'notes' && (
          <NotesPage
            tasks={tasks}
            setTasks={persistTasks}
            apiKey={apiKey}
            setApiKey={persistApiKey}
            showToast={showToast}
          />
        )}
        {page === 'upload' && (
          <UploadPage
            tasks={tasks}
            setTasks={persistTasks}
            apiKey={apiKey}
            setApiKey={persistApiKey}
            showToast={showToast}
          />
        )}
        {page === 'contacts' && (
          <ContactsPage contacts={contacts} tasks={tasks} setTasks={persistTasks} showToast={showToast} />
        )}
        {page === 'reports' && (
          <ReportsPage tasks={tasks} showToast={showToast} apiKey={apiKey} />
        )}
      </div>

      <div className="nav-spacer" />
      <nav className="bottom-nav">
        {NAV.map(n => (
          <button
            key={n.id}
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

export default App
