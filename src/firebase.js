import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyAOOReMBqWLOimGL7EeEyFLldPU1rVlEX4",
  authDomain: "mahami-ba8fa.firebaseapp.com",
  projectId: "mahami-ba8fa",
  storageBucket: "mahami-ba8fa.firebasestorage.app",
  messagingSenderId: "957143670408",
  appId: "1:957143670408:web:33151564a85c7d7fcf093d",
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db   = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
