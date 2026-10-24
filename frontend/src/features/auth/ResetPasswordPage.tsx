import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'

/** Forgot password: email a link (GoTrue /recover), then set a new password from that link. */
export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [recovery, setRecovery] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (window.location.hash.includes('type=recovery')) setRecovery(true)
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  async function sendLink(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setBusy(false)
    setMessage(
      error
        ? { ok: false, text: error.message }
        : { ok: true, text: 'If this email has an account, a reset link is on its way.' },
    )
  }

  async function setNewPassword(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setMessage({ ok: false, text: 'Password must be at least 8 characters.' })
    setBusy(true)
    setMessage(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setMessage({ ok: false, text: error.message })
    navigate('/app', { replace: true })
  }

  return (
    <div className="auth-shell">
      <div className="auth-brand hidden md:flex">
        <p className="text-xs tracking-[0.12em] text-teal-200/80 font-semibold mb-4">Metallurgy Lab SaaS</p>
        <h1>Reset Your Password</h1>
      </div>
      <div className="auth-form-wrap">
        {recovery ? (
          <form onSubmit={setNewPassword} className="auth-card">
            <h1 className="text-2xl font-bold">Set New Password</h1>
            <div className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-[var(--muted)] tracking-wide" htmlFor="rp-pw">
                  New Password
                </label>
                <input id="rp-pw" className="input mt-1.5" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {message && <p className={`text-sm ${message.ok ? 'text-[var(--ok)]' : 'text-[var(--danger)]'}`}>{message.text}</p>}
              <button className="btn btn-primary w-full" disabled={busy}>
                {busy ? 'Saving…' : 'Save Password'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={sendLink} className="auth-card">
            <h1 className="text-2xl font-bold">Forgot Password</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">We will email you a reset link.</p>
            <div className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-[var(--muted)] tracking-wide" htmlFor="rp-email">
                  Email
                </label>
                <input id="rp-email" className="input mt-1.5" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {message && <p className={`text-sm ${message.ok ? 'text-[var(--ok)]' : 'text-[var(--danger)]'}`}>{message.text}</p>}
              <button className="btn btn-primary w-full" disabled={busy}>
                {busy ? 'Sending…' : 'Send Reset Link'}
              </button>
            </div>
            <p className="mt-4 text-sm text-[var(--muted)]">
              <Link className="text-[var(--accent)] font-semibold hover:underline" to="/login">
                Back to Sign In
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
