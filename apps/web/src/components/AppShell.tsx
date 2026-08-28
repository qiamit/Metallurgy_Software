"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Aperture,
  Atom,
  Beaker,
  Camera,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Ruler,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { formatRole } from "@/lib/text";

const NAV = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/capture", label: "Capture Studio", icon: Camera },
  { href: "/app/calibrations", label: "Calibration", icon: Ruler },
  { href: "/app/analysis", label: "Analysis & Jobs", icon: Beaker },
  { href: "/app/periodic-table", label: "Periodic Table", icon: Atom },
];

const SETTINGS_MENU = [
  { label: "Laboratory Setting", section: "lab", adminOnly: true },
  { label: "User Management", section: "users", adminOnly: true },
  { label: "Roles & Module Access", section: "roles", adminOnly: true },
  { label: "AI Setting", section: "ai", adminOnly: true },
  { label: "Contact Us", section: "contact", adminOnly: false },
  { label: "Help", section: "help", adminOnly: false },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, orgs, orgId, logout, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ml_sidebar_open");
      if (saved !== null) setSidebarOpen(saved === "true");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("ml_sidebar_open", String(sidebarOpen));
    } catch {
      /* ignore */
    }
  }, [sidebarOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[var(--sidebar)] text-[var(--sidebar-text)]">
        <div className="flex flex-col items-center gap-3">
          <Aperture className="animate-pulse text-[var(--accent)]" size={28} />
          <span className="text-sm">Loading Workspace…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") router.replace("/login");
    return null;
  }

  const currentOrg = orgs.find((o) => o.id === orgId);
  const canAccessAdmin =
    currentOrg?.role === "owner" || currentOrg?.role === "admin";
  const initials = user.full_name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const visibleMenu = SETTINGS_MENU.filter(
    (item) => !item.adminOnly || canAccessAdmin,
  );

  return (
    <div className="min-h-screen flex bg-[var(--bg)] text-[var(--ink)]">
      {/* Sidebar */}
      <aside
        className={`sidebar shrink-0 flex flex-col border-r border-[var(--sidebar-border)] transition-[width] duration-200 ease-out overflow-hidden ${
          sidebarOpen ? "w-[272px]" : "w-0 border-r-0"
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
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href === "/app/analysis" && pathname.startsWith("/app/jobs")) ||
              (item.href !== "/app" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${active ? "sidebar-link-active" : ""}`}
              >
                <span className="sidebar-icon">
                  <Icon size={16} strokeWidth={active ? 2.25 : 2} />
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer min-w-[272px]">
          <span className="sidebar-footer-badge">ISO Standards Aligned</span>
          <p className="sidebar-footer-text">
            Metallography Analysis Workspace for Professional Laboratories.
          </p>
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
            <div className="text-sm text-[var(--muted)] font-medium truncate max-w-[min(480px,50vw)]">
              {currentOrg?.name || "Lab Workspace"}
            </div>
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
                <div className="w-8 h-8 rounded-none bg-gradient-to-br from-[var(--accent)] to-[#0369a1] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {initials || "U"}
                </div>
                <div className="min-w-0 text-left hidden sm:block">
                  <div className="text-sm font-semibold text-[var(--ink)] truncate">
                    {user.full_name}
                  </div>
                  <div className="text-[11px] text-[var(--muted)] truncate max-w-[180px]">
                    {currentOrg?.role ? formatRole(currentOrg.role) : "Member"}
                  </div>
                </div>
                <ChevronDown
                  size={16}
                  className={`text-[var(--muted)] shrink-0 transition-transform ${menuOpen ? "rotate-180" : ""}`}
                />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(280px,calc(100vw-2rem))] rounded-none border border-[var(--line)] bg-white shadow-[var(--shadow-lg)] py-2">
                  <div className="px-4 pb-2 border-b border-[var(--line)] mb-1">
                    <div className="font-medium text-sm text-[var(--ink)]">{user.full_name}</div>
                    <div className="text-xs text-[var(--muted)] truncate">{user.email}</div>
                  </div>

                  <nav className="flex flex-col">
                    {visibleMenu.map((item) => (
                      <Link
                        key={item.section}
                        href={`/app/admin?section=${item.section}`}
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
                      onClick={() => {
                        setMenuOpen(false);
                        logout();
                        router.push("/login");
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
        <div className="flex-1 pt-[2mm] px-[2mm] overflow-auto">{children}</div>
      </main>
    </div>
  );
}
