/**
 * Firestore helpers for tasks, users, and requests.
 * Collections:
 *   tasks/     – all tasks (previously localStorage)
 *   users/     – keyed by Firebase UID { email, name, role, createdAt }
 *   requests/  – pending user requests { type, payload, requestedBy, status, createdAt }
 */
import {
  collection, doc, getDocs, getDoc,
  addDoc, setDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'

/* ─── TASKS ──────────────────────────────────────────────── */

export function subscribeToTasks(callback) {
  const q = query(collection(db, 'tasks'), orderBy('createdAt', 'asc'))
  return onSnapshot(q, snap => {
    const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(tasks)
  })
}

export async function addTask(taskData) {
  const ref = await addDoc(collection(db, 'tasks'), {
    ...taskData,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateTask(id, data) {
  await updateDoc(doc(db, 'tasks', id), data)
}

export async function deleteTask(id) {
  await deleteDoc(doc(db, 'tasks', id))
}

/** Bulk-import tasks from localStorage array (first run migration) */
export async function importTasksFromArray(tasksArray) {
  const batch = writeBatch(db)
  tasksArray.forEach(t => {
    const { id: _id, ...rest } = t
    const ref = doc(collection(db, 'tasks'))
    batch.set(ref, { ...rest, createdAt: serverTimestamp() })
  })
  await batch.commit()
}

/** Returns true if Firestore tasks collection is empty */
export async function isTasksEmpty() {
  const snap = await getDocs(collection(db, 'tasks'))
  return snap.empty
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

export async function updateUserRole(uid, role) {
  await updateDoc(doc(db, 'users', uid), { role })
}

export async function deleteUser(uid) {
  await deleteDoc(doc(db, 'users', uid))
}

/* ─── REQUESTS ───────────────────────────────────────────── */

/**
 * type: 'add' | 'edit_title' | 'edit_date' | 'close' | 'request_update'
 * payload: data relevant to the request
 */
export async function createRequest({ type, payload, requestedBy, requestedByName }) {
  await addDoc(collection(db, 'requests'), {
    type,
    payload,
    requestedBy,
    requestedByName,
    status: 'pending',
    createdAt: serverTimestamp(),
  })
}

export function subscribeToPendingRequests(callback) {
  const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, snap => {
    const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(reqs)
  })
}

export async function approveRequest(requestId, requestData) {
  const { type, payload } = requestData

  if (type === 'add') {
    await addTask(payload)
  } else if (type === 'edit_title') {
    await updateTask(payload.taskId, { title: payload.title })
  } else if (type === 'edit_date') {
    await updateTask(payload.taskId, { dueDate: payload.dueDate })
  } else if (type === 'close') {
    await updateTask(payload.taskId, {
      done: true,
      completedAt: new Date().toISOString(),
    })
  }

  await updateDoc(doc(db, 'requests', requestId), { status: 'approved' })
}

export async function rejectRequest(requestId) {
  await updateDoc(doc(db, 'requests', requestId), { status: 'rejected' })
}

/* ─── TASK UPDATES (طلب تحديث من الموظف) ─────────────────── */

/**
 * المدير يطلب تحديث من الموظف على مهمة معينة
 */
export async function requestTaskUpdate({ taskId, taskTitle, requestedFrom, requestedFromName, requestedBy, requestedByName, message }) {
  await addDoc(collection(db, 'task_updates'), {
    taskId,
    taskTitle,
    requestedFrom,      // UID of employee
    requestedFromName,  // name of employee
    requestedBy,        // UID of manager
    requestedByName,    // name of manager
    message: message || 'يرجى تقديم تحديث عن حالة هذه المهمة',
    response: '',
    status: 'pending',  // pending → responded
    createdAt: serverTimestamp(),
  })
}

/**
 * الموظف يرد بالتحديث
 */
export async function respondToUpdateRequest(updateId, response) {
  await updateDoc(doc(db, 'task_updates', updateId), {
    response,
    status: 'responded',
    respondedAt: serverTimestamp(),
  })
}

/**
 * اشترك في طلبات التحديث الموجهة لمستخدم معين (الموظف)
 */
export function subscribeToMyUpdateRequests(callback) {
  const q = query(collection(db, 'task_updates'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, snap => {
    const updates = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(updates)
  })
}
