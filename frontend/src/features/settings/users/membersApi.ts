import { supabase } from '@/lib/supabaseClient'
import { callFunction } from '@/lib/functionsClient'
import type { Role } from '@/types'

export type Member = {
  id: string
  user_id: string
  role: Role
  full_name: string
  email: string
  status: string
}

type Row = {
  id: string
  user_id: string
  role: Role
  user_profiles: { full_name: string | null; email: string | null; status: string | null } | null
}

export async function fetchMembers(orgId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select('id, user_id, role, user_profiles(full_name, email, status)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    role: r.role,
    full_name: r.user_profiles?.full_name ?? '',
    email: r.user_profiles?.email ?? '',
    status: r.user_profiles?.status ?? 'Active',
  }))
}

export function addMember(orgId: string, input: { email: string; full_name: string; password: string; role: Role }) {
  return callFunction('create-user', { organization_id: orgId, ...input })
}

export function updateMemberRole(orgId: string, membershipId: string, role: Role) {
  return callFunction('update-member', { organization_id: orgId, membership_id: membershipId, role })
}

export function removeMember(orgId: string, membershipId: string) {
  return callFunction('remove-member', { organization_id: orgId, membership_id: membershipId })
}

export function resetMemberPassword(orgId: string, membershipId: string, password: string) {
  return callFunction('reset-member-password', { organization_id: orgId, membership_id: membershipId, password })
}
