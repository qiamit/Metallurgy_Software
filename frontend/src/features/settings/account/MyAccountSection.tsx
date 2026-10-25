import { useState, type FormEvent } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'

export function MyAccountSection() {
  const { user, profileName, refresh } = useAuth()
  const [name, setName] = useState(profileName)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSaveName(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setBusy(true)
    setMessage(null)
    const { error } = await supabase.from('user_profiles').update({ full_name: name.trim() }).eq('id', user.id)
    setBusy(false)
    if (error) return setMessage({ ok: false, text: error.message })
    await refresh()
    setMessage({ ok: true, text: 'Name updated.' })
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault()
    if (password.length < 10) return setMessage({ ok: false, text: 'Password must be at least 10 characters.' })
    if (password !== confirm) return setMessage({ ok: false, text: 'Passwords do not match.' })
    setBusy(true)
    setMessage(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setMessage({ ok: false, text: error.message })
    setPassword('')
    setConfirm('')
    setMessage({ ok: true, text: 'Password changed.' })
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <form onSubmit={onSaveName} className="card p-6 space-y-4">
        <h2 className="font-semibold">Profile</h2>
        <div>
          <label className="text-xs text-[var(--muted)]" htmlFor="acc-email">
            Email
          </label>
          <input id="acc-email" className="input mt-1" value={user?.email ?? ''} disabled />
        </div>
        <div>
          <label className="text-xs text-[var(--muted)]" htmlFor="acc-name">
            Full Name
          </label>
          <input id="acc-name" className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          Save Name
        </button>
      </form>
      <form onSubmit={onChangePassword} className="card p-6 space-y-4">
        <h2 className="font-semibold">Change Password</h2>
        <div>
          <label className="text-xs text-[var(--muted)]" htmlFor="acc-pw">
            New Password
          </label>
          <input id="acc-pw" className="input mt-1" type="password" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div>
          <label className="text-xs text-[var(--muted)]" htmlFor="acc-pw2">
            Confirm Password
          </label>
          <input id="acc-pw2" className="input mt-1" type="password" minLength={10} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          Change Password
        </button>
      </form>
      {message && (
        <p className={`text-sm lg:col-span-2 ${message.ok ? 'text-[var(--ok)]' : 'text-[var(--danger)]'}`}>{message.text}</p>
      )}
    </div>
  )
}
