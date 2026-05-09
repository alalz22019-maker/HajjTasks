/**
 * Firestore helpers — نسخة أعمال الحج
 */
import {
  collection, doc, getDocs, getDoc,
  addDoc, setDoc, updateDoc, deleteDoc,
  query, orderBy, where, onSnapshot, serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'

/* ─── HAJJ TASKS ─────────────────────────────────────────── */

export function subscribeToTasks(callback) {
  // بدون orderBy عشان نتجنب مشاكل الفهرسة
  const ref = collection(db, 'hajj_tasks')
  return onSnapshot(ref, snap => {
    const tasks = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(t => t.title) // تجاهل المهام بدون عنوان
    tasks.sort((a, b) => {
      const da = a.createdAt?.toDate?.() || new Date(a.createdAt || 0)
      const db2 = b.createdAt?.toDate?.() || new Date(b.createdAt || 0)
      return da - db2
    })
    callback(tasks)
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
  const ref = collection(db, 'hajj_reports')
  return onSnapshot(ref, snap => {
    const reports = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    reports.sort((a, b) => {
      const da = a.createdAt?.toDate?.() || new Date(a.createdAt || 0)
      const db2 = b.createdAt?.toDate?.() || new Date(b.createdAt || 0)
      return db2 - da // الأحدث أولاً
    })
    callback(reports)
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

/* ─── REPORT TYPES ───────────────────────────────────────── */

export function subscribeToReportTypes(callback) {
  const ref = collection(db, 'hajj_report_types')
  return onSnapshot(ref, snap => {
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
  try {
    const ref = doc(db, 'hajj_tasks', taskId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return
    const current = snap.data().activityLog || []
    await updateDoc(ref, {
      activityLog: [...current, { ...logEntry, at: new Date().toISOString() }]
    })
  } catch (e) { /* silent */ }
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
  const ref = collection(db, 'hajj_notifications')
  return onSnapshot(ref, snap => {
    const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    notifs.sort((a, b) => {
      const da = a.createdAt?.toDate?.() || new Date(a.createdAt || 0)
      const db2 = b.createdAt?.toDate?.() || new Date(b.createdAt || 0)
      return db2 - da
    })
    callback(notifs)
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

/* ─── STUBS ──────────────────────────────────────────────── */

export async function createRequest(data) {
  return await addTask(data.payload || data)
}

export async function addUpdateToTask(taskId, updateEntry) {
  try {
    const ref = doc(db, 'hajj_tasks', taskId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return
    const current = snap.data().updates || []
    await updateDoc(ref, {
      updates: [...current, { ...updateEntry, timestamp: new Date().toISOString() }]
    })
  } catch (e) { /* silent */ }
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

export const STAR_CATEGORIES = ['Action Accelerator', 'Innovation Spark', 'Extra Miler', 'Collaboration Legend']
export async function saveWeeklyStar(data) {}
export function subscribeToWeeklyStars(callback) { callback([]); return () => {} }
