import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
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
        const snap = await getDoc(doc(db, 'users', fbUser.uid))
        if (snap.exists()) {
          setUserProfile({ uid: fbUser.uid, ...snap.data() })
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
