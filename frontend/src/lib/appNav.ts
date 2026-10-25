import { Atom, Beaker, Camera, CircleDot, Gauge, LayoutDashboard, LineChart, Ruler, type LucideIcon } from 'lucide-react'
import type { Role } from '@/types'

export type NavItem = {
  label: string
  to: string
  icon: LucideIcon
  /** Also highlight this item for these path prefixes. */
  alsoActive?: string[]
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/capture', label: 'Capture Studio', icon: Camera },
  { to: '/app/calibrations', label: 'Calibration', icon: Ruler },
  { to: '/app/analysis', label: 'Analysis & Jobs', icon: Beaker, alsoActive: ['/app/jobs'] },
  { to: '/app/ring-test', label: 'Ring Test', icon: CircleDot },
  { to: '/app/hardness', label: 'Hardness Conversion', icon: Gauge },
  { to: '/app/phase-diagram', label: 'Fe–C Phase Diagram', icon: LineChart },
  { to: '/app/periodic-table', label: 'Periodic Table', icon: Atom },
]

export type SettingsSection = 'lab' | 'users' | 'roles' | 'audit' | 'account' | 'contact' | 'help'

export const SETTINGS_MENU: { label: string; section: SettingsSection; minRole: Role | null }[] = [
  { label: 'Laboratory Setting', section: 'lab', minRole: 'admin' },
  { label: 'User Management', section: 'users', minRole: 'admin' },
  { label: 'Roles & Module Access', section: 'roles', minRole: 'admin' },
  { label: 'Audit Log', section: 'audit', minRole: 'admin' },
  { label: 'My Account', section: 'account', minRole: null },
  { label: 'Contact Us', section: 'contact', minRole: null },
  { label: 'Help', section: 'help', minRole: null },
]

export function isNavActive(item: NavItem, pathname: string): boolean {
  if (pathname === item.to) return true
  if (item.alsoActive?.some((p) => pathname.startsWith(p))) return true
  return item.to !== '/app' && pathname.startsWith(item.to)
}
