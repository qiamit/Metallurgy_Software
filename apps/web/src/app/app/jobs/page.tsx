"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ANALYSIS_LABELS, type AnalysisJob } from "@/lib/types";

function statusBadge(status: string) {
  if (status === "completed" || status === "reviewed") return "badge badge-ok";
  if (status === "failed" || status === "rejected") return "badge badge-danger";
  if (status === "processing" || status === "pending") return "badge badge-warn";
  return "badge badge-muted";
}

export default function JobsPage() {
  const { orgId } = useAuth();
  const [jobs, setJobs] = useState<AnalysisJob[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orgId) return;
    api<AnalysisJob[]>(`/api/orgs/${orgId}/jobs`)
      .then(setJobs)
      .catch((e) => setError(e.message));
  }, [orgId]);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Jobs & AI Compare</h1>
          <p className="text-[var(--muted)] mt-1">
            Software vs AI advisory comparison for each analysis job.
          </p>
        </div>
        <Link href="/app/capture" className="btn btn-primary">
          New analysis
        </Link>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--accent)] text-white">
            <tr>
              <th className="text-left px-4 py-3">Created</th>
              <th className="text-left px-4 py-3">Module</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Agreement</th>
              <th className="text-left px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const agreement =
                (job.comparison?.agreement as string | undefined) || "—";
              return (
                <tr key={job.id} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3">
                    {new Date(job.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {ANALYSIS_LABELS[job.analysis_type]}
                  </td>
                  <td className="px-4 py-3">
                    <span className={statusBadge(job.status)}>{job.status}</span>
                  </td>
                  <td className="px-4 py-3 capitalize">{agreement}</td>
                  <td className="px-4 py-3 text-right">
                    <Link className="text-[var(--accent)] font-medium" href={`/app/jobs/${job.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!jobs.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-[var(--muted)]">
                  No jobs yet. Run an analysis from Capture Studio.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
