import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { CircleHelp, FileText, FlaskConical, Settings } from "lucide-react";

const TABS = [
  { href: "/app/ring-test", label: "New Test", icon: FlaskConical, exact: true },
  { href: "/app/ring-test/reports", label: "Reports", icon: FileText, exact: false },
  { href: "/app/ring-test/settings", label: "Settings", icon: Settings, exact: false },
  { href: "/app/ring-test/help", label: "Help", icon: CircleHelp, exact: false },
] as const;

export function RingTestNav() {
  const pathname = useLocation().pathname;

  return (
    <nav className="rt-subnav rt-subnav-inline">
      {TABS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link key={href} to={href} className={active ? "rt-subnav-active" : undefined}>
            <Icon size={16} className="shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function RingTestShell({
  title,
  children,
}: {
  title?: string;
  /** @deprecated Subtitles removed — kept for call-site compatibility */
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rt-shell">
      <div className="rt-topbar mb-4">
        <div className="rt-brand shrink-0">
          <div className="grid h-8 w-8 place-items-center bg-[var(--rt-primary)] text-sm font-bold text-white">
            R
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white">Ring Test Manager</div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--rt-muted)]">
              IS 1786:2008
            </div>
          </div>
        </div>
        <RingTestNav />
      </div>
      {title ? <h1 className="page-title mb-4">{title}</h1> : null}
      <div>{children}</div>
    </div>
  );
}
