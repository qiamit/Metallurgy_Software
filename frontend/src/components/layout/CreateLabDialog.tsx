import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'

export function CreateLabDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { createOrg } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await createOrg(name.trim())
      setName('')
      onOpenChange(false)
      navigate('/app')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create lab')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Lab Workspace</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Organization / Lab Name</span>
            <input className="input mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </label>
          <p className="text-xs text-[var(--muted)]">You Become the Owner of the New Workspace.</p>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <DialogFooter>
            <button type="button" className="btn btn-ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create Workspace'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
