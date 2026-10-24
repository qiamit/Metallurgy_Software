import type { Role } from '@/types'

export const ROLE_RANK: Record<Role, number> = {
  viewer: 1,
  analyst: 2,
  reviewer: 3,
  admin: 4,
  owner: 5,
}

export const ROLE_DESCRIPTIONS: { role: Role; label: string; text: string }[] = [
  { role: 'owner', label: 'Owner', text: 'Full Control' },
  { role: 'admin', label: 'Admin', text: 'Users & Calibrations' },
  { role: 'analyst', label: 'Analyst', text: 'Capture & Run Analysis' },
  { role: 'reviewer', label: 'Reviewer', text: 'Approve / Reject Results' },
  { role: 'viewer', label: 'Viewer', text: 'Read-Only' },
]

/** True when `role` is at least `minimum` (same order the database enforces). */
export function hasRole(role: Role | null | undefined, minimum: Role): boolean {
  if (!role) return false
  return ROLE_RANK[role] >= ROLE_RANK[minimum]
}
