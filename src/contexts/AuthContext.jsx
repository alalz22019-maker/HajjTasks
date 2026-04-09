import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db, googleProvider } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined) // undefined = loading
  const [userProfile, setUserProfile]   = useState(null)      // Firestore profile
  const [authError, setAuthError]       = useState('')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setFirebaseUser(null)
        setUserProfile(null)
        return
      }
      setFirebaseUser(fbUser)
      // Look up user profile in Firestore
      try {
        // 1) Try by UID directly
        let snap = await getDoc(doc(db, 'users', fbUser.uid))
        if (!snap.exists()) {
          // 2) Fallback: look up by email (pre-registered with stub UID by admin)
          const q    = query(collection(db, 'users'), where('email', '==', fbUser.email))
          const qsnap = await getDocs(q)
          if (!qsnap.empty) {
            const oldDoc = qsnap.docs[0]
            // Migrate: write with real UID, delete stub
            const data = oldDoc.data()
            await setDoc(doc(db, 'users', fbUser.uid), {
              ...data,
              name: fbUser.displayName || data.name,
              photoURL: fbUser.photoURL || '',
            })
            snap = await getDoc(doc(db, 'users', fbUser.uid))
          }
        }
        if (snap.exists()) {
          const data = snap.data()
          // Sync displayName and photo on every login
          await setDoc(doc(db, 'users', fbUser.uid), {
            ...data,
            name: data.name || fbUser.displayName || '',
            photoURL: fbUser.photoURL || data.photoURL || '',
          }, { merge: true })
          setUserProfile({ uid: fbUser.uid, photoURL: fbUser.photoURL, ...data })
          setAuthError('')
        } else {
          // User authenticated but not in our users collection
          setUserProfile(null)
          setAuthError('غير مصرح لك بالدخول. تواصل مع المدير لإضافة حسابك.')
          await signOut(auth)
          setFirebaseUser(null)
        }
      } catch (e) {
        console.error('Profile fetch error:', e)
        setAuthError('خطأ في التحقق من الصلاحيات. حاول مجدداً.')
        await signOut(auth)
        setFirebaseUser(null)
      }
    })
    return unsub
  }, [])

  async function loginWithGoogle() {
    setAuthError('')
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        setAuthError('فشل تسجيل الدخول. حاول مجدداً.')
      }
    }
  }

  async function loginWithEmail(email, password) {
    setAuthError('')
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (e) {
      const msgs = {
        'auth/user-not-found':   'البريد الإلكتروني غير مسجل.',
        'auth/wrong-password':   'كلمة المرور غير صحيحة.',
        'auth/invalid-email':    'البريد الإلكتروني غير صحيح.',
        'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة.',
        'auth/too-many-requests': 'محاولات كثيرة. حاول لاحقاً.',
      }
      setAuthError(msgs[e.code] || 'فشل تسجيل الدخول. حاول مجدداً.')
    }
  }

  async function logout() {
    await signOut(auth)
    setUserProfile(null)
    setAuthError('')
  }

  const isAdmin     = userProfile?.role === 'admin'
  const isSuperUser = userProfile?.role === 'superuser'
  const isUser      = userProfile?.role === 'user'

  return (
    <AuthContext.Provider value={{
      firebaseUser,
      userProfile,
      authError,
      setAuthError,
      loginWithGoogle,
      loginWithEmail,
      logout,
      isAdmin,
      isSuperUser,
      isUser,
      loading: firebaseUser === undefined,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
