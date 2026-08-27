"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Aperture,
  Beaker,
  Camera,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Ruler,
  Settings,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const NAV = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/capture", label: "Capture Studio", icon: Camera },
  { href: "/app/calibrations", label: "Calibration", icon: Ruler },
  { href: "/app/analysis", label: "Analysis", icon: Beaker },
  { href: "/app/jobs", label: "Jobs & Compare", icon: ClipboardList },
  { href: "/app/admin", label: "Admin", icon: Users },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, orgs, orgId, selectOrg, logout, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-[var(--muted)]">
        Loading workspace…
      </div>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") router.replace("/login");
    return null;
  }

  const currentOrg = orgs.find((o) => o.id === orgId);

  return (
    <div className="min-h-screen flex bg-[var(--bg)] text-[var(--ink)]">
      <aside className="w-64 shrink-0 border-r border-[var(--line)] bg-[var(--panel)] flex flex-col">
        <div className="px-5 py-6 border-b border-[var(--line)]">
          <div className="flex items-center gap-2">
            <Aperture className="text-[var(--accent)]" size={22} />
            <div>
              <div className="font-semibold tracking-tight">Metallurgy Lab</div>
              <div className="text-xs text-[var(--muted)]">Image Analysis SaaS</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/app" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--accent-ink)] font-medium"
                    : "text-[var(--muted)] hover:bg-black/5 hover:text-[var(--ink)]"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-[var(--line)] space-y-3">
          <label className="block text-xs text-[var(--muted)]">Organization</label>
          <select
            className="w-full rounded-md border border-[var(--line)] bg-white px-2 py-1.5 text-sm"
            value={orgId || ""}
            onChange={(e) => selectOrg(e.target.value)}
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.role})
              </option>
            ))}
          </select>
          <div className="flex items-center justify-between text-sm">
            <div>
              <div className="font-medium">{user.full_name}</div>
              <div className="text-xs text-[var(--muted)]">{user.email}</div>
            </div>
            <button
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="p-2 rounded-md hover:bg-black/5 text-[var(--muted)]"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
          {currentOrg && (
            <div className="text-[11px] text-[var(--muted)] flex items-center gap-1">
              <Settings size={12} /> Role: {currentOrg.role}
            </div>
          )}
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="h-14 border-b border-[var(--line)] bg-[var(--panel)]/80 backdrop-blur px-8 flex items-center justify-between">
          <div className="text-sm text-[var(--muted)]">
            Professional metallography testing workspace
          </div>
          <div className="text-xs uppercase tracking-[0.14em] text-[var(--accent)]">
            Standards-aligned
          </div>
        </div>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
