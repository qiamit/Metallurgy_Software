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
  const [aiBusy, setAiBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [aiNotice, setAiNotice] = useState("");

  async function load() {
    if (!orgId) return;
    const data = await api<AnalysisJob>(`/api/orgs/${orgId}/jobs/${params.id}`);
    setJob(data);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [orgId, params.id]);

  async function retryAi() {
    if (!orgId || !job || aiBusy) return;
    if (!job.source_image_key) {
      setError("Cannot Retry AI — Source Image Is Missing for This Job.");
      return;
    }
    setAiBusy(true);
    setError("");
    setAiNotice("Retrying AI analysis… This may take up to a minute.");
    try {
      const updated = await api<AnalysisJob>(`/api/orgs/${orgId}/jobs/${job.id}/ai`, {
        method: "POST",
      });
      setJob(updated);
      setAiNotice("AI analysis updated.");
    } catch (e) {
      setAiNotice("");
      setError(e instanceof Error ? e.message : "Retry Failed");
    } finally {
      setAiBusy(false);
    }
  }

  async function review(approve: boolean) {
    if (!orgId || !job || reviewBusy) return;
    setReviewBusy(true);
    try {
      await api(`/api/orgs/${orgId}/jobs/${job.id}/review`, {
        method: "POST",
        body: JSON.stringify({ approve, notes: approve ? "Approved" : "Rejected" }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review Failed");
    } finally {
      setReviewBusy(false);
    }
  }

  if (!job) {
    return <div className="text-[var(--muted)]">{error || "Loading Job…"}</div>;
  }

  const deltas = (job.comparison?.deltas || {}) as Record<
    string,
    { software: number; ai: number; absolute_diff: number }
  >;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-4 min-w-0">
          <Link href="/app/analysis?view=jobs" className="text-sm text-[var(--accent)] shrink-0">
            ← All Jobs
          </Link>
          <h1 className="page-title min-w-0">
            {ANALYSIS_LABELS[job.analysis_type]}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
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
            Download PDF Report
          </a>
          <button
            className="btn btn-primary"
            disabled={aiBusy || !job.source_image_key}
            onClick={retryAi}
            type="button"
          >
            {aiBusy ? "Retrying…" : "Retry AI Analysis"}
          </button>
          <button className="btn btn-ghost" disabled={reviewBusy} onClick={() => review(true)} type="button">
            Approve
          </button>
          <button className="btn btn-ghost" disabled={reviewBusy} onClick={() => review(false)} type="button">
            Reject
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {aiNotice && !error && <p className="text-sm text-[var(--accent)]">{aiNotice}</p>}
      {job.error_message && (
        <p className="card p-4 text-sm text-[var(--danger)]">{job.error_message}</p>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-4">
          <h2 className="font-semibold mb-3">Source Image</h2>
          {job.source_image_key ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={fileUrl(job.source_image_key)}
              alt="Source"
              className="w-full border border-[var(--line)] bg-white object-contain max-h-[420px]"
            />
          ) : (
            <p className="text-sm text-[var(--muted)] py-8 text-center">No Source Image Available.</p>
          )}
        </div>
        <div className="card p-4">
          <h2 className="font-semibold mb-3">Software Overlay</h2>
          {job.overlay_image_key ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={fileUrl(job.overlay_image_key)}
              alt="Overlay"
              className="w-full border border-[var(--line)] bg-white object-contain max-h-[420px]"
            />
          ) : (
            <p className="text-sm text-[var(--muted)] py-8 text-center">No Overlay Available.</p>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Software Analysis (Primary)</h2>
            <span className="badge badge-ok">Standards-Oriented</span>
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
            <h2 className="font-semibold">AI Analysis (Advisory)</h2>
            <span className="badge badge-warn">Not Sole Authority</span>
          </div>
          <p className="mt-3 text-sm text-[var(--muted)]">
            {String(job.ai_result?.observations || "No AI Observations.")}
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
          {String(job.comparison?.summary || "Comparison Unavailable.")}
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
                    No Numeric Deltas (AI May Be in Fallback Mode Without API Key).
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
