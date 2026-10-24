import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { ROLE_DESCRIPTIONS, ROLE_RANK } from '@/lib/roles'
import { formatRole } from '@/lib/text'
import type { Role } from '@/types'
import {
  addMember,
  fetchMembers,
  removeMember,
  resetMemberPassword,
  updateMemberRole,
  type Member,
} from '@/features/settings/users/membersApi'

const ALL_ROLES: Role[] = ['owner', 'admin', 'reviewer', 'analyst', 'viewer']

export function UserManagementSection() {
  const { orgId, role: myRole, user } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [form, setForm] = useState({ email: '', full_name: '', password: '', role: 'analyst' as Role })
  const [roleMenuOpen, setRoleMenuOpen] = useState(false)
  const [inviteMenuOpen, setInviteMenuOpen] = useState(false)
  const headerActionsRef = useRef<HTMLDivElement>(null)

  // No one can grant a role above their own (the functions service checks this too).
  const grantable = ALL_ROLES.filter((r) => myRole && ROLE_RANK[r] <= ROLE_RANK[myRole])
  const canManage = (m: Member) => Boolean(myRole && ROLE_RANK[m.role] <= ROLE_RANK[myRole])

  const load = useCallback(async () => {
    if (!orgId) return
    setMembers(await fetchMembers(orgId))
  }, [orgId])

  useEffect(() => {
    load().catch((e) => setError(e.message))
  }, [load])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (headerActionsRef.current && !headerActionsRef.current.contains(e.target as Node)) {
        setRoleMenuOpen(false)
        setInviteMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function run(id: string, fn: () => Promise<unknown>, done: string) {
    setBusyId(id)
    setError('')
    setNotice('')
    try {
      await fn()
      setNotice(done)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusyId(null)
    }
  }

  async function onInvite(e: FormEvent) {
    e.preventDefault()
    if (!orgId) return
    await run('invite', () => addMember(orgId, form), 'Employee added.')
    setForm({ email: '', full_name: '', password: '', role: 'analyst' })
    setInviteMenuOpen(false)
  }

  function onReset(m: Member) {
    if (!orgId) return
    const password = window.prompt(`New temporary password for ${m.full_name || m.email} (min 8 characters)`)
    if (!password) return
    run(m.id, () => resetMemberPassword(orgId, m.id, password), 'Password reset.')
  }

  function onRemove(m: Member) {
    if (!orgId) return
    if (!window.confirm(`Remove ${m.full_name || m.email} from this lab?`)) return
    run(m.id, () => removeMember(orgId, m.id), 'Member removed.')
  }

  return (
    <section className="card p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="font-semibold">User Management</h2>
        <div className="flex flex-wrap items-center gap-2 shrink-0" ref={headerActionsRef}>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setInviteMenuOpen(false)
                setRoleMenuOpen((open) => !open)
              }}
              className="btn btn-ghost flex items-center gap-2"
            >
              Role Model
              <ChevronDown size={16} className={roleMenuOpen ? 'rotate-180' : ''} />
            </button>
            {roleMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(320px,calc(100vw-2rem))] border border-[var(--line)] bg-white shadow-[var(--shadow-lg)] p-4">
                <ul className="text-sm text-[var(--muted)] space-y-1.5">
                  {ROLE_DESCRIPTIONS.map((r) => (
                    <li key={r.role}>
                      <b className="text-[var(--ink)]">{r.label}</b> — {r.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setRoleMenuOpen(false)
                setInviteMenuOpen((open) => !open)
              }}
              className="btn btn-primary flex items-center gap-2"
            >
              Add Employee
              <ChevronDown size={16} className={inviteMenuOpen ? 'rotate-180' : ''} />
            </button>
            {inviteMenuOpen && (
              <form
                onSubmit={onInvite}
                className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(360px,calc(100vw-2rem))] border border-[var(--line)] bg-white shadow-[var(--shadow-lg)] p-5 space-y-4"
              >
                {(
                  [
                    ['full_name', 'Full Name', 'text'],
                    ['email', 'Email', 'email'],
                    ['password', 'Temp Password', 'password'],
                  ] as const
                ).map(([key, label, type]) => (
                  <div key={key}>
                    <label className="text-xs text-[var(--muted)]" htmlFor={`invite-${key}`}>
                      {label}
                    </label>
                    <input
                      id={`invite-${key}`}
                      className="input mt-1"
                      type={type}
                      required={key !== 'password'}
                      minLength={key === 'password' ? 8 : undefined}
                      value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    />
                  </div>
                ))}
                <p className="text-[11px] text-[var(--muted)]">
                  Existing users (already in another lab) keep their password; leave it blank for them.
                </p>
                <div>
                  <label className="text-xs text-[var(--muted)]" htmlFor="invite-role">
                    Role
                  </label>
                  <select
                    id="invite-role"
                    className="input mt-1"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                  >
                    {grantable.map((r) => (
                      <option key={r} value={r}>
                        {formatRole(r)}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="btn btn-primary w-full" type="submit" disabled={busyId === 'invite'}>
                  {busyId === 'invite' ? 'Adding…' : 'Add Employee'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {notice && !error && <p className="text-sm text-[var(--ok)]">{notice}</p>}
      <div className="overflow-hidden border border-[var(--line)]">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-right px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isMe = m.user_id === user?.id
              const editable = canManage(m) && !isMe
              return (
                <tr key={m.id} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3">
                    {m.full_name}
                    {isMe && <span className="text-[var(--muted)]"> (You)</span>}
                  </td>
                  <td className="px-4 py-3">{m.email}</td>
                  <td className="px-4 py-3">
                    {editable ? (
                      <select
                        className="input py-1"
                        aria-label={`Role for ${m.full_name || m.email}`}
                        value={m.role}
                        disabled={busyId === m.id}
                        onChange={(e) =>
                          orgId && run(m.id, () => updateMemberRole(orgId, m.id, e.target.value as Role), 'Role updated.')
                        }
                      >
                        {grantable.map((r) => (
                          <option key={r} value={r}>
                            {formatRole(r)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      formatRole(m.role)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editable && (
                      <div className="flex justify-end gap-2">
                        <button type="button" className="btn btn-ghost px-3 py-1.5 text-xs" disabled={busyId === m.id} onClick={() => onReset(m)}>
                          Reset Password
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost px-3 py-1.5 text-xs text-[var(--danger)] border-[var(--danger)]"
                          disabled={busyId === m.id}
                          onClick={() => onRemove(m)}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
