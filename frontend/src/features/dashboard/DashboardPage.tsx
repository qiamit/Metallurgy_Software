import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Atom, Camera, CircleDot, FlaskConical, Gauge, LineChart, Ruler, Sigma, type LucideIcon } from "lucide-react";
import { fetchDashboardStats, fetchJobs } from "@/features/analysis/analysisApi";
import { ModuleGrid } from "@/features/analysis/ModuleGrid";
import { statusBadge } from "@/features/analysis/JobsList";
import { listRingTests } from "@/features/ring-test/ringTestApi";
import { useAuth } from "@/hooks/useAuth";
import { formatStatus } from "@/lib/text";
import { ANALYSIS_LABELS, type AnalysisJob, type DashboardStats } from "@/types";

const ACTIONS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/app/capture", label: "New Analysis", icon: Camera },
  { to: "/app/ring-test", label: "Ring Test", icon: CircleDot },
  { to: "/app/calibrations", label: "Calibration", icon: Ruler },
];

const TOOLS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/app/hardness", label: "Hardness", icon: Gauge },
  { to: "/app/phase-diagram", label: "Fe–C Diagram", icon: LineChart },
  { to: "/app/periodic-table", label: "Periodic Table", icon: Atom },
  { to: "/app/constants", label: "Constants & Units", icon: Sigma },
];

export default function DashboardPage() {
  const { orgId } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<AnalysisJob[]>([]);
  const [ringCount, setRingCount] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orgId) return;
    fetchDashboardStats(orgId)
      .then(setStats)
      .catch((e) => setError(e.message));
    fetchJobs(orgId, 6)
      .then(setRecent)
      .catch(() => setRecent([]));
    listRingTests()
      .then((r) => setRingCount(r.length))
      .catch(() => setRingCount(null));
  }, [orgId]);

  const kpis: [string, number | string][] = [
    ["Samples", stats?.samples ?? "—"],
    ["Analysis Jobs", stats?.jobs ?? "—"],
    ["Completed", stats?.completed ?? "—"],
    ["Pending", stats?.pending ?? "—"],
    ["Ring Tests", ringCount ?? "—"],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map(({ to, label, icon: Icon }, i) => (
            <Link key={to} to={to} className={`btn ${i === 0 ? "btn-primary" : "btn-ghost"}`}>
              <Icon size={16} /> {label}
            </Link>
          ))}
        </div>
      </div>
      {error && <p className="text-[var(--danger)] text-sm">{error}</p>}

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map(([label, value]) => (
          <div key={label} className="stat-card border-t-2 border-t-[var(--accent)] last:col-span-2 sm:last:col-span-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</div>
            <div className="mt-1 text-2xl sm:text-3xl font-semibold tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="section-title">Analysis Modules</h2>
        <ModuleGrid counts={(stats?.by_type ?? {}) as Record<string, number>} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="card p-4 sm:p-5 min-w-0">
          <div className="section-title flex items-center justify-between">
            <span>Recent Jobs</span>
            <Link to="/app/analysis?view=jobs" className="normal-case tracking-normal text-xs font-medium text-[var(--accent-ink)] hover:underline">
              All Jobs
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--muted)]">No jobs yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {recent.map((job) => (
                <li key={job.id}>
                  <Link to={`/app/jobs/${job.id}`} className="flex items-center gap-3 py-2.5 hover:bg-[var(--bg-subtle)] -mx-2 px-2">
                    <FlaskConical size={16} className="shrink-0 text-[var(--muted)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{ANALYSIS_LABELS[job.analysis_type]}</span>
                      <span className="block text-xs text-[var(--muted)]">{new Date(job.created_at).toLocaleString()}</span>
                    </span>
                    <span className={`${statusBadge(job.status)} shrink-0`}>{formatStatus(job.status)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-4 sm:p-5">
          <h2 className="section-title">Tools</h2>
          <div className="grid grid-cols-2 gap-2">
            {TOOLS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex flex-col items-start gap-2 border border-[var(--line)] p-3 transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
              >
                <Icon size={18} className="text-[var(--accent-ink)]" />
                <span className="text-sm font-medium leading-tight">{label}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
