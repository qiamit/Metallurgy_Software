import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import { callFunction } from '@/lib/functionsClient'
import type { Organization, Role } from '@/types'

const ORG_STORAGE_KEY = 'ms_org_id'

export type RegisterPayload = {
  email: string
  password: string
  full_name: string
  organization_name: string
}

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  profileName: string
  orgs: Organization[]
  orgId: string | null
  org: Organization | null
  role: Role | null
  login: (email: string, password: string) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => Promise<void>
  selectOrg: (id: string) => void
  createOrg: (name: string) => Promise<string>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

function clearAuthStorage() {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (k) keys.push(k)
    }
    for (const k of keys) {
      if (k.startsWith('sb-') && k.endsWith('-auth-token')) localStorage.removeItem(k)
    }
  } catch {
    // ignore
  }
}

function readSavedOrg(): string | null {
  try {
    return localStorage.getItem(ORG_STORAGE_KEY)
  } catch {
    return null
  }
}

function saveOrg(id: string | null) {
  try {
    if (id) localStorage.setItem(ORG_STORAGE_KEY, id)
    else localStorage.removeItem(ORG_STORAGE_KEY)
  } catch {
    // ignore
  }
}

type MembershipRow = {
  role: Role
  organizations: { id: string; name: string; slug: string } | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  useEffect(() => {
    let canceled = false
    supabase.auth.getSession().then(({ data, error }) => {
      if (canceled) return
      if (error && String(error.message).toLowerCase().includes('refresh token')) clearAuthStorage()
      setSession(data.session ?? null)
      setUser(data.session?.user ?? null)
      setSessionLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession((prev) =>
        prev?.access_token === next?.access_token && prev?.user?.id === next?.user?.id ? prev : next,
      )
      setUser((prev) => (prev?.id && prev.id === next?.user?.id ? prev : (next?.user ?? null)))
    })
    return () => {
      canceled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const loadProfile = useCallback(async (userId: string) => {
    setProfileLoading(true)
    try {
      const [{ data: profile }, { data: rows, error }] = await Promise.all([
        supabase.from('user_profiles').select('full_name, status').eq('id', userId).maybeSingle(),
        supabase
          .from('memberships')
          .select('role, organizations(id, name, slug)')
          .eq('user_id', userId)
          .order('created_at', { ascending: true }),
      ])
      if (String(profile?.status ?? '').trim().toLowerCase() === 'inactive') {
        await supabase.auth.signOut()
        return
      }
      if (error) throw error
      const list: Organization[] = ((rows ?? []) as unknown as MembershipRow[])
        .filter((r) => r.organizations)
        .map((r) => ({ ...r.organizations!, role: r.role }))
      setProfileName(String(profile?.full_name ?? ''))
      setOrgs(list)
      const saved = readSavedOrg()
      const next = list.find((o) => o.id === saved)?.id ?? list[0]?.id ?? null
      setOrgId(next)
      saveOrg(next)
    } finally {
      setProfileLoading(false)
    }
  }, [])

  // Load profile + labs once per signed-in user; `loadedFor` marks which user is loaded.
  useEffect(() => {
    const id = user?.id ?? null
    if (!id || loadedFor === id) return
    let canceled = false
    loadProfile(id)
      .catch(() => {
        if (canceled) return
        setOrgs([])
        setOrgId(null)
      })
      .finally(() => {
        if (!canceled) setLoadedFor(id)
      })
    return () => {
      canceled = true
    }
  }, [user?.id, loadedFor, loadProfile])

  const refresh = useCallback(async () => {
    if (user?.id) await loadProfile(user.id)
  }, [user?.id, loadProfile])

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Invalid credentials' : error.message)
  }, [])

  const register = useCallback(async (payload: RegisterPayload) => {
    await callFunction('register', payload, { anonymous: true })
    const { error } = await supabase.auth.signInWithPassword({
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
    })
    if (error) throw new Error(error.message)
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    saveOrg(null)
    setOrgs([])
    setOrgId(null)
    setProfileName('')
    setLoadedFor(null)
  }, [])

  const selectOrg = useCallback((id: string) => {
    saveOrg(id)
    setOrgId(id)
  }, [])

  const createOrg = useCallback(
    async (name: string) => {
      const { data, error } = await supabase.rpc('create_my_organization', { p_name: name })
      if (error) throw new Error(error.message)
      const id = String(data)
      saveOrg(id)
      if (user?.id) await loadProfile(user.id)
      return id
    },
    [user?.id, loadProfile],
  )

  const visibleOrgs = useMemo(() => (user ? orgs : []), [user, orgs])
  const org = useMemo(() => (user ? (orgs.find((o) => o.id === orgId) ?? null) : null), [user, orgs, orgId])
  const loading = sessionLoading || profileLoading || (Boolean(user) && loadedFor !== user?.id)
  const signedIn = Boolean(user)

  const value = useMemo<AuthState>(
    () => ({
      user,
      session,
      loading,
      profileName,
      orgs: visibleOrgs,
      orgId: signedIn ? orgId : null,
      org,
      role: org?.role ?? null,
      login,
      register,
      logout,
      selectOrg,
      createOrg,
      refresh,
    }),
    [user, session, loading, profileName, visibleOrgs, signedIn, orgId, org, login, register, logout, selectOrg, createOrg, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
