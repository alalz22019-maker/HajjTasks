/**
 * Firestore helpers — نسخة أعمال الحج
 * Collections: hajj_tasks, hajj_reports, hajj_report_types, users, notifications
 */
import {
  collection, doc, getDocs, getDoc,
  addDoc, setDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'

/* ─── HAJJ TASKS ─────────────────────────────────────────── */

export function subscribeToTasks(callback) {
  const q = query(collection(db, 'hajj_tasks'), orderBy('createdAt', 'asc'))
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

export async function addTask(taskData) {
  const ref = await addDoc(collection(db, 'hajj_tasks'), {
    ...taskData,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateTask(id, data) {
  await updateDoc(doc(db, 'hajj_tasks', id), data)
}

export async function deleteTask(id) {
  await deleteDoc(doc(db, 'hajj_tasks', id))
}

/* ─── HAJJ REPORTS ───────────────────────────────────────── */

export function subscribeToHajjReports(callback) {
  const q = query(collection(db, 'hajj_reports'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

export async function addHajjReport(reportData) {
  const ref = await addDoc(collection(db, 'hajj_reports'), {
    ...reportData,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateHajjReport(id, data) {
  await updateDoc(doc(db, 'hajj_reports', id), data)
}

export async function deleteHajjReport(id) {
  await deleteDoc(doc(db, 'hajj_reports', id))
}

/* ─── REPORT TYPES (أنواع التقارير — قابلة للإضافة) ─────── */

export function subscribeToReportTypes(callback) {
  const q = query(collection(db, 'hajj_report_types'), orderBy('createdAt', 'asc'))
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

export async function addReportType(typeData) {
  const ref = await addDoc(collection(db, 'hajj_report_types'), {
    ...typeData,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function deleteReportType(id) {
  await deleteDoc(doc(db, 'hajj_report_types', id))
}

/* ─── ACTIVITY LOG ───────────────────────────────────────── */

export async function addActivityLog(taskId, logEntry) {
  const ref = doc(db, 'hajj_tasks', taskId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const current = snap.data().activityLog || []
  await updateDoc(ref, {
    activityLog: [...current, { ...logEntry, at: new Date().toISOString() }]
  })
}

/* ─── USERS ──────────────────────────────────────────────── */

export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }))
}

export async function createUser({ uid, email, name, role }) {
  await setDoc(doc(db, 'users', uid), {
    email, name, role, createdAt: serverTimestamp(),
  })
}

/* ─── NOTIFICATIONS ──────────────────────────────────────── */

export function subscribeToNotifications(callback) {
  const q = query(collection(db, 'hajj_notifications'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

export async function addNotification(data) {
  await addDoc(collection(db, 'hajj_notifications'), {
    ...data, read: false, createdAt: serverTimestamp(),
  })
}

export async function markNotificationRead(id) {
  await updateDoc(doc(db, 'hajj_notifications', id), { read: true })
}

/* ─── STUBS for compatibility ─────────────────────────────── */

export async function createRequest(data) {
  // في نسخة الحج الكل admin — لا يوجد طلبات اعتماد
  // نضيف المهمة مباشرة
  return await addTask(data.payload || data)
}

export async function addUpdateToTask(taskId, updateEntry) {
  const ref = doc(db, 'hajj_tasks', taskId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const current = snap.data().updates || []
  await updateDoc(ref, {
    updates: [...current, { ...updateEntry, timestamp: new Date().toISOString() }]
  })
}

export async function importTasksFromArray(tasksArray) {
  const batch = writeBatch(db)
  tasksArray.forEach(t => {
    const { id: _id, ...rest } = t
    const ref = doc(collection(db, 'hajj_tasks'))
    batch.set(ref, { ...rest, createdAt: serverTimestamp() })
  })
  await batch.commit()
}

export async function isTasksEmpty() {
  const snap = await getDocs(collection(db, 'hajj_tasks'))
  return snap.empty
}

/* ─── WEEKLY STAR stubs (not used in hajj but needed for MyDashboard import) ── */

export const STAR_CATEGORIES = [
  'Action Accelerator',
  'Innovation Spark',
  'Extra Miler',
  'Collaboration Legend',
]

export async function saveWeeklyStar(data) {
  // Not used in hajj version
}

export function subscribeToWeeklyStars(callback) {
  callback([])
  return () => {}
}
