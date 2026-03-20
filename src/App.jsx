import { useState, useEffect, useCallback } from 'react'
import TasksPage from './pages/TasksPage'
import NotesPage from './pages/NotesPage'
import UploadPage from './pages/UploadPage'
import ContactsPage from './pages/ContactsPage'
import ReportsPage from './pages/ReportsPage'
import { loadData, saveData } from './utils/storage'
import Toast from './components/Toast'

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
    const envKey = import.meta.env.VITE_ANTHROPIC_API_KEY || ''
    const storedKey = loadData('mytasks_apikey') || ''
    const key = envKey || storedKey
    setTasks(storedTasks)
    setApiKey(key)
    if (envKey && !storedKey) saveData('mytasks_apikey', envKey)
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

      <div style={{ flex: 1, overflow: 'hidden' }}>
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
          <ContactsPage contacts={contacts} tasks={tasks} showToast={showToast} />
        )}
        {page === 'reports' && (
          <ReportsPage tasks={tasks} />
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
