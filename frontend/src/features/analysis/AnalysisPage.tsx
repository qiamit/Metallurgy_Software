import { Link, useSearchParams } from "react-router-dom";
import { Suspense, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import {
  EMPTY_JOB_FILTERS,
  JobsFilterDropdown,
  type JobFilters,
} from "@/features/analysis/JobsFilterDropdown";
import { JobsList } from "@/features/analysis/JobsList";
import { ModuleGrid } from "@/features/analysis/ModuleGrid";
import { fetchDashboardStats } from "@/features/analysis/analysisApi";
import { useAuth } from "@/hooks/useAuth";

function AnalysisContent() {
  const [params] = useSearchParams();
  const { orgId } = useAuth();
  const view = params.get("view") === "jobs" ? "jobs" : "modules";
  const [jobFilters, setJobFilters] = useState<JobFilters>(EMPTY_JOB_FILTERS);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!orgId) return;
    fetchDashboardStats(orgId)
      .then((s) => setCounts((s.by_type ?? {}) as Record<string, number>))
      .catch(() => setCounts({}));
  }, [orgId]);

  const tab = (key: "modules" | "jobs", label: string) => (
    <Link
      to={`/app/analysis?view=${key}`}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        view === key
          ? "border-[var(--accent)] text-[var(--accent-ink)]"
          : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Analysis & Jobs</h1>
        <Link to="/app/capture" className="btn btn-primary">
          <Plus size={16} /> New Analysis
        </Link>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)]">
        <nav className="flex gap-1">
          {tab("modules", "Modules")}
          {tab("jobs", "Jobs")}
        </nav>
        {view === "jobs" && (
          <div className="pb-2">
            <JobsFilterDropdown filters={jobFilters} onChange={setJobFilters} />
          </div>
        )}
      </div>

      {view === "jobs" ? <JobsList filters={jobFilters} /> : <ModuleGrid counts={counts} />}
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <AnalysisContent />
    </Suspense>
  );
}
