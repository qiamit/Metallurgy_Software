"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, fileUrl, getApiUrl, getToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ANALYSIS_LABELS, type AnalysisJob } from "@/lib/types";

export default function JobDetailPage() {
  const { orgId } = useAuth();
  const params = useParams<{ id: string }>();
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!orgId) return;
    const data = await api<AnalysisJob>(`/api/orgs/${orgId}/jobs/${params.id}`);
    setJob(data);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [orgId, params.id]);

  async function review(approve: boolean) {
    if (!orgId || !job) return;
    setBusy(true);
    try {
      await api(`/api/orgs/${orgId}/jobs/${job.id}/review`, {
        method: "POST",
        body: JSON.stringify({ approve, notes: approve ? "Approved" : "Rejected" }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setBusy(false);
    }
  }

  if (!job) {
    return <div className="text-[var(--muted)]">{error || "Loading job…"}</div>;
  }

  const deltas = (job.comparison?.deltas || {}) as Record<
    string,
    { software: number; ai: number; absolute_diff: number }
  >;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/app/jobs" className="text-sm text-[var(--accent)]">
            ← All jobs
          </Link>
          <h1 className="text-3xl font-semibold mt-2">
            {ANALYSIS_LABELS[job.analysis_type]}
          </h1>
          <p className="text-[var(--muted)] mt-1">
            Status: <span className="capitalize">{job.status}</span>
            {job.comparison?.agreement != null
              ? ` · AI agreement: ${String(job.comparison.agreement)}`
              : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            className="btn btn-ghost"
            href={`${getApiUrl()}/api/orgs/${orgId}/jobs/${job.id}/report.pdf`}
            onClick={(e) => {
              const token = getToken();
              if (!token) return;
              e.preventDefault();
              fetch(`${getApiUrl()}/api/orgs/${orgId}/jobs/${job.id}/report.pdf`, {
                headers: { Authorization: `Bearer ${token}` },
              })
                .then((r) => r.blob())
                .then((blob) => {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `report-${job.id}.pdf`;
                  a.click();
                });
            }}
          >
            Download PDF report
          </a>
          <button className="btn btn-ghost" disabled={busy} onClick={() => review(true)}>
            Approve
          </button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => review(false)}>
            Reject
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {job.error_message && (
        <p className="card p-4 text-sm text-[var(--danger)]">{job.error_message}</p>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-4">
          <h2 className="font-semibold mb-3">Source image</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl(job.source_image_key)}
            alt="Source"
            className="w-full rounded-lg border border-[var(--line)] bg-white object-contain max-h-[420px]"
          />
        </div>
        <div className="card p-4">
          <h2 className="font-semibold mb-3">Software overlay</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl(job.overlay_image_key)}
            alt="Overlay"
            className="w-full rounded-lg border border-[var(--line)] bg-white object-contain max-h-[420px]"
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Software analysis (Primary)</h2>
            <span className="badge badge-ok">Standards-oriented</span>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            {Object.entries(job.software_result || {}).map(([k, v]) =>
              typeof v === "object" ? null : (
                <div key={k} className="flex justify-between gap-4 border-b border-[var(--line)] py-1.5">
                  <dt className="text-[var(--muted)]">{k}</dt>
                  <dd className="font-medium text-right">{String(v)}</dd>
                </div>
              ),
            )}
          </dl>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">AI analysis (Advisory)</h2>
            <span className="badge badge-warn">Not sole authority</span>
          </div>
          <p className="mt-3 text-sm text-[var(--muted)]">
            {String(job.ai_result?.observations || "No AI observations.")}
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            {Object.entries(job.ai_result || {})
              .filter(([k]) => !["observations", "caveats", "provider", "model", "advisory"].includes(k))
              .map(([k, v]) =>
                typeof v === "object" ? null : (
                  <div key={k} className="flex justify-between gap-4 border-b border-[var(--line)] py-1.5">
                    <dt className="text-[var(--muted)]">{k}</dt>
                    <dd className="font-medium text-right">{String(v)}</dd>
                  </div>
                ),
              )}
          </dl>
          {Boolean(job.ai_result?.caveats) && (
            <p className="mt-3 text-xs text-[var(--warn)]">{String(job.ai_result?.caveats)}</p>
          )}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold">Comparison</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {String(job.comparison?.summary || "Comparison unavailable.")}
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--muted)]">
                <th className="py-2">Metric</th>
                <th>Software</th>
                <th>AI</th>
                <th>Diff</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(deltas).map(([k, d]) => (
                <tr key={k} className="border-t border-[var(--line)]">
                  <td className="py-2">{k}</td>
                  <td>{d.software}</td>
                  <td>{d.ai}</td>
                  <td>{d.absolute_diff}</td>
                </tr>
              ))}
              {!Object.keys(deltas).length && (
                <tr>
                  <td colSpan={4} className="py-4 text-[var(--muted)]">
                    No numeric deltas (AI may be in fallback mode without API key).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
