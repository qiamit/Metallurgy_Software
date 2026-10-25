import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchDashboardStats } from "@/features/analysis/analysisApi";
import { useAuth } from "@/hooks/useAuth";
import { ANALYSIS_LABELS, type AnalysisType, type DashboardStats } from "@/types";

export default function DashboardPage() {
  const { orgId } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orgId) return;
    fetchDashboardStats(orgId)
      .then(setStats)
      .catch((e) => setError(e.message));
  }, [orgId]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Dashboard</h1>
      </div>
      {error && <p className="text-[var(--danger)] text-sm">{error}</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ["Samples", stats?.samples ?? "—"],
          ["Total Jobs", stats?.jobs ?? "—"],
          ["Completed", stats?.completed ?? "—"],
          ["Pending", stats?.pending ?? "—"],
        ].map(([label, value]) => (
          <div key={label} className="stat-card">
            <div className="text-xs tracking-wide text-[var(--muted)]">{label}</div>
            <div className="mt-2 text-3xl font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold">Analysis Modules</h2>
        <div className="mt-4 grid md:grid-cols-2 gap-3">
          {(Object.keys(ANALYSIS_LABELS) as AnalysisType[]).map((key) => (
            <Link
              key={key}
              to={`/app/analysis?type=${key}`}
              className="border border-[var(--line)] bg-[var(--panel)] px-4 py-3 hover:border-[var(--accent)] transition"
            >
              <div className="font-medium">{ANALYSIS_LABELS[key]}</div>
              <div className="text-xs text-[var(--muted)] mt-1">
                Jobs: {stats?.by_type?.[key] ?? 0}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Link to="/app/capture" className="btn btn-primary">
          Open Capture Studio
        </Link>
        <Link to="/app/analysis?view=jobs" className="btn btn-ghost">
          View Jobs
        </Link>
      </div>
    </div>
  );
}
