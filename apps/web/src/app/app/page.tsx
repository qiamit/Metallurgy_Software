"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { DashboardStats } from "@/lib/types";
import { ANALYSIS_LABELS, type AnalysisType } from "@/lib/types";

export default function DashboardPage() {
  const { orgId } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orgId) return;
    api<DashboardStats>(`/api/orgs/${orgId}/dashboard`)
      .then(setStats)
      .catch((e) => setError(e.message));
  }, [orgId]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="text-[var(--muted)] mt-1">
          Overview of samples, jobs, and module usage for your lab.
        </p>
      </div>
      {error && <p className="text-[var(--danger)] text-sm">{error}</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ["Samples", stats?.samples ?? "—"],
          ["Total jobs", stats?.jobs ?? "—"],
          ["Completed", stats?.completed ?? "—"],
          ["Pending", stats?.pending ?? "—"],
        ].map(([label, value]) => (
          <div key={label} className="card p-5">
            <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</div>
            <div className="mt-2 text-3xl font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold">Analysis modules</h2>
        <div className="mt-4 grid md:grid-cols-2 gap-3">
          {(Object.keys(ANALYSIS_LABELS) as AnalysisType[]).map((key) => (
            <Link
              key={key}
              href={`/app/analysis?type=${key}`}
              className="rounded-lg border border-[var(--line)] bg-white px-4 py-3 hover:border-[var(--accent)] transition"
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
        <Link href="/app/capture" className="btn btn-primary">
          Open Capture Studio
        </Link>
        <Link href="/app/jobs" className="btn btn-ghost">
          View jobs & AI compare
        </Link>
      </div>
    </div>
  );
}
