import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const app = initializeApp({
  apiKey: "AIzaSyAOOReMBqWLOimGL7EeEyFLldPU1rVlEX4",
  authDomain: "mahami-ba8fa.firebaseapp.com",
  projectId: "mahami-ba8fa",
});
const db = getFirestore(app);

export default async function handler(req, res) {
  // Simple auth check
  if (req.query.key !== 'mahami2026') {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const tasksSnap = await getDocs(collection(db, 'tasks'));
    const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const reportsSnap = await getDocs(collection(db, 'business_reports'));
    const reports = reportsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const usersSnap = await getDocs(collection(db, 'users'));
    const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    res.status(200).json({
      taskCount: tasks.length,
      reportCount: reports.length,
      userCount: users.length,
      tasks,
      reports,
      users,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
