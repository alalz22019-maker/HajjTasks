import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyCh2mK-v6gKy7A8FzGUbffHs8CJJIm6XZk",
  authDomain: "hajj-ops-17f7a.firebaseapp.com",
  projectId: "hajj-ops-17f7a",
  storageBucket: "hajj-ops-17f7a.firebasestorage.app",
  messagingSenderId: "249024146317",
  appId: "1:249024146317:web:1e2943cda0b094365b2bc4",
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db   = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
