import { Navigate, useLocation } from 'react-router-dom'
import { Aperture } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export function WorkspaceLoading() {
  return (
    <div className="min-h-screen grid place-items-center bg-[var(--sidebar)] text-[var(--sidebar-text)]">
      <div className="flex flex-col items-center gap-3">
        <Aperture className="animate-pulse text-[var(--accent)]" size={28} />
        <span className="text-sm">Loading Workspace…</span>
      </div>
    </div>
  )
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <WorkspaceLoading />
  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }
  return <>{children}</>
}
