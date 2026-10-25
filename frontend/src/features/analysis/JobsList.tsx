import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { hasRole } from "@/lib/roles";
import { deleteJobs, fetchJobs } from "@/features/analysis/analysisApi";
import { formatStatus } from "@/lib/text";
import { ANALYSIS_LABELS, type AnalysisJob } from "@/types";
import type { JobFilters } from "@/features/analysis/JobsFilterDropdown";

function statusBadge(status: string) {
  if (status === "completed" || status === "reviewed") return "badge badge-ok";
  if (status === "failed" || status === "rejected") return "badge badge-danger";
  if (status === "processing" || status === "pending") return "badge badge-warn";
  return "badge badge-muted";
}

export function JobsList({ filters }: { filters?: JobFilters }) {
  const { orgId, role } = useAuth();
  const canEdit = hasRole(role, "analyst");
  const isAdmin = hasRole(role, "admin");
  const canChange = (job: AnalysisJob) =>
    canEdit && (isAdmin || (job.status !== "reviewed" && job.status !== "rejected"));
  const [jobs, setJobs] = useState<AnalysisJob[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    if (!orgId) return;
    const data = await fetchJobs(orgId);
    setJobs(data);
    setSelected((prev) => {
      const ids = new Set(data.map((j) => j.id));
      return new Set([...prev].filter((id) => ids.has(id)));
    });
  }, [orgId]);

  useEffect(() => {
    loadJobs().catch((e) => setError(e.message));
  }, [loadJobs]);

  const filteredJobs = jobs.filter((job) => {
    if (!filters) return true;
    if (filters.module && job.analysis_type !== filters.module) return false;
    if (filters.status && job.status !== filters.status) return false;
    if (filters.query.trim()) {
      const q = filters.query.trim().toLowerCase();
      const haystack = [
        job.id,
        ANALYSIS_LABELS[job.analysis_type],
        job.status,
        new Date(job.created_at).toLocaleString(),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const allSelected =
    filteredJobs.length > 0 && filteredJobs.every((job) => selected.has(job.id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredJobs.map((j) => j.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteJob(id: string) {
    if (!orgId) return;
    if (!window.confirm("Delete this analysis job? This cannot be undone.")) return;
    setDeletingId(id);
    setError("");
    try {
      await deleteJobs(jobs.filter((j) => j.id === id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await loadJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete Failed");
    } finally {
      setDeletingId(null);
    }
  }

  async function deleteSelected() {
    const targets = jobs.filter((j) => selected.has(j.id) && canChange(j));
    const skipped = selected.size - targets.length;
    if (skipped > 0 && !targets.length) {
      setError("Reviewed jobs can only be deleted by an admin.");
      return;
    }
    if (!targets.length) return;
    if (!window.confirm(`Delete ${targets.length} analysis job(s)? This cannot be undone.`)) return;
    setDeletingId("bulk");
    setError("");
    try {
      await deleteJobs(targets);
      setSelected(new Set());
      await loadJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete Failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {canEdit && selected.size > 0 && (
        <div className="card px-4 py-3 flex items-center justify-between text-sm">
          <span>{selected.size} selected</span>
          <button
            type="button"
            className="btn btn-ghost text-[var(--danger)] border-[var(--danger)]"
            disabled={deletingId === "bulk"}
            onClick={deleteSelected}
          >
            {deletingId === "bulk" ? "Deleting…" : "Delete Selected"}
          </button>
        </div>
      )}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="w-12 px-4 py-3">
                <input
                  aria-label="Select All Jobs"
                  checked={allSelected}
                  className="h-4 w-4"
                  onChange={toggleAll}
                  type="checkbox"
                />
              </th>
              <th className="text-left px-4 py-3">Created</th>
              <th className="text-left px-4 py-3">Module</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredJobs.map((job) => {
              const isDeleting = deletingId === job.id;
              return (
                <tr key={job.id} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3">
                    <input
                      aria-label={`Select Job ${job.id}`}
                      checked={selected.has(job.id)}
                      className="h-4 w-4"
                      onChange={() => toggleOne(job.id)}
                      type="checkbox"
                    />
                  </td>
                  <td className="px-4 py-3">
                    {new Date(job.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {ANALYSIS_LABELS[job.analysis_type]}
                  </td>
                  <td className="px-4 py-3">
                    <span className={statusBadge(job.status)}>{formatStatus(job.status)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        className="btn btn-primary px-3 py-1.5 text-xs"
                        to={`/app/jobs/${job.id}`}
                      >
                        Open
                      </Link>
                      {canChange(job) && (
                      <Link
                        className="btn btn-ghost px-3 py-1.5 text-xs"
                        to={`/app/jobs/${job.id}?edit=1`}
                      >
                        Edit
                      </Link>
                      )}
                      {canChange(job) && (
                      <button
                        className="btn btn-ghost px-3 py-1.5 text-xs text-[var(--danger)] border-[var(--danger)]"
                        disabled={isDeleting}
                        onClick={() => deleteJob(job.id)}
                        type="button"
                      >
                        {isDeleting ? "Deleting…" : "Delete"}
                      </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filteredJobs.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-[var(--muted)]">
                  {jobs.length
                    ? "No Jobs Match Your Search or Filters."
                    : "No Jobs Yet. Run an Analysis From Capture Studio."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
