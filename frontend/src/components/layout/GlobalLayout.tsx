import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Aperture, Building2, Check, ChevronDown, LogOut, Menu, Plus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { NAV_ITEMS, SETTINGS_MENU, isNavActive } from '@/lib/appNav'
import { hasRole } from '@/lib/roles'
import { formatRole } from '@/lib/text'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CreateLabDialog } from '@/components/layout/CreateLabDialog'

const SIDEBAR_KEY = 'ml_sidebar_open'

function readSidebarOpen(): boolean {
  try {
    const saved = localStorage.getItem(SIDEBAR_KEY)
    return saved === null ? true : saved === 'true'
  } catch {
    return true
  }
}

export function GlobalLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, profileName, orgs, org, role, logout, selectOrg } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarOpen)
  const [createOpen, setCreateOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, String(sidebarOpen))
    } catch {
      /* ignore */
    }
  }, [sidebarOpen])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!user) return null

  const displayName = profileName || user.email || 'User'
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
  const visibleMenu = SETTINGS_MENU.filter((item) => !item.minRole || hasRole(role, item.minRole))

  return (
    <div className="min-h-screen flex bg-[var(--bg)] text-[var(--ink)]">
      <aside
        className={`sidebar shrink-0 flex flex-col border-r border-[var(--sidebar-border)] transition-[width] duration-200 ease-out overflow-hidden ${
          sidebarOpen ? 'w-[272px]' : 'w-0 border-r-0'
        }`}
      >
        <div className="sidebar-brand min-w-[272px]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="sidebar-brand-mark shrink-0">
                <Aperture className="text-white" size={20} strokeWidth={2.25} />
              </div>
              <div className="sidebar-brand-text min-w-0">
                <span className="sidebar-brand-title truncate">Metallurgy Lab</span>
                <span className="sidebar-brand-sub truncate">Image Analysis SaaS</span>
              </div>
            </div>
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(false)}
              title="Hide Sidebar"
              aria-label="Hide Sidebar"
            >
              <Menu size={18} strokeWidth={2.25} />
            </button>
          </div>
        </div>

        <div className="sidebar-section-label min-w-[272px]">Main Menu</div>
        <nav className="sidebar-nav min-w-[272px]">
          {NAV_ITEMS.map((item) => {
            const active = isNavActive(item, pathname)
            const Icon = item.icon
            return (
              <Link key={item.to} to={item.to} className={`sidebar-link ${active ? 'sidebar-link-active' : ''}`}>
                <span className="sidebar-icon">
                  <Icon size={16} strokeWidth={active ? 2.25 : 2} />
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-footer min-w-[272px]">
          <span className="sidebar-footer-badge">ISO Standards Aligned</span>
          <p className="sidebar-footer-text">Metallography Analysis Workspace for Professional Laboratories.</p>
        </div>
      </aside>

      <main id="app-main" className="relative flex-1 min-w-0 flex flex-col">
        <div className="relative z-30 h-[56px] shrink-0 border-b border-[var(--line)] bg-[var(--panel)]/90 backdrop-blur-md px-8 flex items-center justify-between shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-3 min-w-0">
            {!sidebarOpen && (
              <button
                type="button"
                className="topbar-menu-toggle"
                onClick={() => setSidebarOpen(true)}
                title="Show Sidebar"
                aria-label="Show Sidebar"
              >
                <Menu size={18} strokeWidth={2.25} />
              </button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm text-[var(--muted)] font-medium max-w-[min(480px,50vw)] hover:text-[var(--ink)]"
                  aria-label="Switch Lab Workspace"
                >
                  <Building2 size={15} className="shrink-0" />
                  <span className="truncate">{org?.name || 'Lab Workspace'}</span>
                  <ChevronDown size={14} className="shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[280px]">
                <DropdownMenuLabel>Lab Workspaces</DropdownMenuLabel>
                {orgs.map((o) => (
                  <DropdownMenuItem
                    key={o.id}
                    onSelect={() => {
                      selectOrg(o.id)
                      navigate('/app')
                    }}
                  >
                    <span className="flex-1 truncate">{o.name}</span>
                    <span className="text-[11px] text-[var(--muted)]">{formatRole(o.role)}</span>
                    {o.id === org?.id && <Check size={14} className="text-[var(--accent)]" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
                  <Plus size={14} /> Create New Lab Workspace
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-2.5 rounded-none border border-[var(--line)] bg-white px-2.5 py-1.5 hover:border-[var(--accent)] transition max-w-[280px]"
                aria-expanded={menuOpen}
                aria-haspopup="true"
              >
                <div className="w-8 h-8 rounded-none bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {initials || 'U'}
                </div>
                <div className="min-w-0 text-left hidden sm:block">
                  <div className="text-sm font-semibold text-[var(--ink)] truncate">{displayName}</div>
                  <div className="text-[11px] text-[var(--muted)] truncate max-w-[180px]">
                    {role ? formatRole(role) : 'Member'}
                  </div>
                </div>
                <ChevronDown
                  size={16}
                  className={`text-[var(--muted)] shrink-0 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(280px,calc(100vw-2rem))] rounded-none border border-[var(--line)] bg-white shadow-[var(--shadow-lg)] py-2">
                  <div className="px-4 pb-2 border-b border-[var(--line)] mb-1">
                    <div className="font-medium text-sm text-[var(--ink)]">{displayName}</div>
                    <div className="text-xs text-[var(--muted)] truncate">{user.email}</div>
                  </div>
                  <nav className="flex flex-col">
                    {visibleMenu.map((item) => (
                      <Link
                        key={item.section}
                        to={`/app/admin?section=${item.section}`}
                        onClick={() => setMenuOpen(false)}
                        className="px-4 py-2.5 text-sm text-[var(--ink)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-ink)] transition"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </nav>
                  <div className="border-t border-[var(--line)] mt-1 pt-1 px-2">
                    <button
                      type="button"
                      onClick={async () => {
                        setMenuOpen(false)
                        await logout()
                        navigate('/login')
                      }}
                      className="w-full flex items-center gap-2 rounded-none px-2 py-2.5 text-sm text-[var(--danger)] hover:bg-red-50 transition"
                    >
                      <LogOut size={15} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex-1 pt-[2mm] px-[2mm] overflow-auto">
          {org ? (
            <Suspense fallback={<div className="p-6 text-sm text-[var(--muted)]">Loading…</div>}>
              <Outlet />
            </Suspense>
          ) : (
            <NoLabYet onCreate={() => setCreateOpen(true)} />
          )}
        </div>
      </main>
      <CreateLabDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}

function NoLabYet({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="card p-6 max-w-lg m-6 space-y-3">
      <h2 className="text-lg font-semibold">No Lab Workspace Yet</h2>
      <p className="text-sm text-[var(--muted)]">
        You are not a member of any lab. Ask your lab admin to add you, or create your own workspace.
      </p>
      <button type="button" className="btn btn-primary" onClick={onCreate}>
        Create Lab Workspace
      </button>
    </div>
  )
}
