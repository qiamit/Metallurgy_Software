import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabaseClient'

type AuditRow = {
  id: number
  action: string
  table_name: string
  record_id: string | null
  user_id: string | null
  created_at: string
}

const PAGE_SIZE = 50

export function AuditLogSection() {
  const { orgId } = useAuth()
  const [rows, setRows] = useState<AuditRow[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [page, setPage] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!orgId) return
    supabase
      .from('audit_log')
      .select('id, action, table_name, record_id, user_id, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      .then(async ({ data, error: err }) => {
        if (err) return setError(err.message)
        const list = (data ?? []) as AuditRow[]
        setRows(list)
        const ids = [...new Set(list.map((r) => r.user_id).filter((v): v is string => Boolean(v)))]
        if (ids.length) {
          const { data: profiles } = await supabase.from('user_profiles').select('id, full_name, email').in('id', ids)
          setNames(Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name || p.email || p.id])))
        }
      })
  }, [orgId, page])

  return (
    <section className="card p-6 space-y-4">
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <div className="overflow-x-auto border border-[var(--line)]">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="text-left px-4 py-3">When</th>
              <th className="text-left px-4 py-3">User</th>
              <th className="text-left px-4 py-3">Action</th>
              <th className="text-left px-4 py-3">Record</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[var(--line)]">
                <td className="px-4 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-2">{(r.user_id && names[r.user_id]) || (r.user_id ? 'User' : 'System')}</td>
                <td className="px-4 py-2">
                  {r.action} · {r.table_name.replace(/_/g, ' ')}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-[var(--muted)]">{r.record_id}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-[var(--muted)]">
                  No Activity Yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          Newer
        </button>
        <button type="button" className="btn btn-ghost" disabled={rows.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>
          Older
        </button>
      </div>
    </section>
  )
}
