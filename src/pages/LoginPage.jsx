import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { loginWithGoogle, authError, setAuthError } = useAuth()

  return (
    <div style={{
      minHeight: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px', background: 'var(--bg)',
    }}>
      {/* Logo / Title */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{
          width: 80, height: 80, borderRadius: 24,
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 40, margin: '0 auto 20px',
          boxShadow: '0 8px 32px rgba(59,130,246,0.35)',
        }}>✓</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text)', marginBottom: 6 }}>
          مهامي Pro
        </div>
        <div style={{ fontSize: 14, color: 'var(--text2)' }}>
          نظام إدارة المهام — PMO وزارة الصحة
        </div>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 360,
        background: 'var(--card)', borderRadius: 20,
        border: '1px solid var(--border)', padding: '32px 24px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8, textAlign: 'center' }}>
          تسجيل الدخول
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center', marginBottom: 28 }}>
          استخدم حسابك المعتمد للدخول إلى النظام
        </div>

        {authError && (
          <div style={{
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 20,
            fontSize: 13, color: '#ef4444', textAlign: 'center', lineHeight: 1.6,
          }}>
            🚫 {authError}
          </div>
        )}

        <button
          onClick={() => { setAuthError(''); loginWithGoogle() }}
          style={{
            width: '100%', padding: '14px 20px', borderRadius: 14,
            background: '#fff', color: '#1a1a1a',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            fontSize: 15, fontWeight: 700, border: '1px solid #e0e0e0',
            cursor: 'pointer', transition: 'opacity 0.15s',
            fontFamily: 'var(--font)',
          }}
          onMouseDown={e => e.currentTarget.style.opacity = '0.8'}
          onMouseUp={e => e.currentTarget.style.opacity = '1'}
        >
          <GoogleIcon />
          الدخول بحساب Google
        </button>

        <div style={{
          marginTop: 24, padding: '12px 16px',
          background: 'var(--bg3)', borderRadius: 10,
          fontSize: 12, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.7,
        }}>
          الدخول متاح للمستخدمين المعتمدين فقط
          <br />تواصل مع مسؤول النظام لإضافة حسابك
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
