import type { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { hasRole } from '@/lib/roles'
import type { Role } from '@/types'

/** Inline access check for a page or a block (the database enforces the same rule). */
export function RequireRole({ min, children, fallback }: { min: Role; children: ReactNode; fallback?: ReactNode }) {
  const { role } = useAuth()
  if (hasRole(role, min)) return <>{children}</>
  return (
    <>
      {fallback ?? (
        <div className="card p-5 text-sm text-[var(--muted)]">
          Access Denied — requires the {min.charAt(0).toUpperCase() + min.slice(1)} role or higher.
        </div>
      )}
    </>
  )
}

/** Renders children only when the current lab role is high enough. */
export function IfRole({ min, children }: { min: Role; children: ReactNode }) {
  const { role } = useAuth()
  return hasRole(role, min) ? <>{children}</> : null
}
