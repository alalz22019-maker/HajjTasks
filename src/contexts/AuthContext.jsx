import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db, googleProvider } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined) // undefined = loading
  const [userProfile, setUserProfile]   = useState(null)      // Firestore profile
  const [authError, setAuthError]       = useState('')

  useEffect(() => {
    // Handle redirect result (for iOS PWA + Staging domains)
    getRedirectResult(auth).catch(e => {
      if (e.code !== 'auth/popup-closed-by-user') {
        console.error('Redirect error:', e)
      }
    })

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setFirebaseUser(null)
        setUserProfile(null)
        return
      }
      setFirebaseUser(fbUser)
      // Look up user profile in Firestore
      try {
        console.log('UID:', fbUser.uid)
        console.log('Email:', fbUser.email)
        // 1) Try by UID directly
        let snap = await getDoc(doc(db, 'users', fbUser.uid))
        console.log('Firestore doc:', snap.exists())
        
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
          // 🔴 التعديل السحري هنا:
          // إذا المستخدم ما عنده بروفايل في قاعدة البيانات، لا تطرده!
          // خله موجود عشان صفحة LoginPage تقدر تطلع له القائمة المنسدلة ويختار اسمه
          setUserProfile(null)
          setAuthError('') 
        }
      } catch (e) {
        console.error('Profile fetch error:', e)
        setAuthError('خطأ في الاتصال بقاعدة البيانات. تأكد من اتصالك بالإنترنت.')
        // شلنا الطرد هنا بعد عشان نعطيه فرصة يحاول مرة ثانية
      }
    })
    return unsub
  }, [])

  async function loginWithGoogle() {
    setAuthError('')
    try {
      // Try popup first (works on desktop browsers)
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/unauthorized-domain' || e.code === 'auth/operation-not-supported-in-this-environment') {
        // Fallback to redirect (works on iOS PWA + unauthorized domains)
        try {
          await signInWithRedirect(auth, googleProvider)
        } catch (redirectErr) {
          setAuthError('فشل تسجيل الدخول. حاول بالإيميل وكلمة المرور.')
        }
      } else if (e.code !== 'auth/popup-closed-by-user') {
        setAuthError('فشل تسجيل الدخول. حاول بالإيميل وكلمة المرور.')
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

  // 🔴 قوائم الصلاحيات (الأسماء مطابقة للقائمة المنسدلة بالضبط)
  const SUPERUSER_NAMES = ['م. علي الزهراني', 'د. منار سمان', 'د. وليد الحسن']
  const ADMIN_NAMES     = ['أ. شادي نبيل', 'أ. مي الأسمري']

  // 🔴 توزيع الصلاحيات الذكي
  const isSuperUser = userProfile?.role === 'superuser' || (userProfile && SUPERUSER_NAMES.includes(userProfile.name))
  const isAdmin     = userProfile?.role === 'admin' || isSuperUser || (userProfile && ADMIN_NAMES.includes(userProfile.name))
  const isUser      = userProfile && !isAdmin && !isSuperUser

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
