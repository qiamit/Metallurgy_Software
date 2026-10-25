import { Link, useParams, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { hasRole } from "@/lib/roles";
import { formatStatus } from "@/lib/text";
import { supabase } from "@/lib/supabaseClient";
import { objectDataUrl, signedUrl } from "@/lib/storage";
import { downloadPdfViaPlaywright } from "@/lib/playwrightPdfClient";
import { ANALYSIS_LABELS, type AnalysisJob, type AnalysisType, type Calibration } from "@/types";
import { fetchJob, rerunAi, reviewJob, updateJobAndRerun } from "@/features/analysis/analysisApi";
import { fetchCalibrations } from "@/features/calibrations/calibrationsApi";
import { loadLabBranding } from "@/features/settings/labSettingsApi";
import { buildJobReportHtml } from "@/features/analysis/buildJobReportHtml";
import { ResultExtras } from "@/features/analysis/ResultExtras";

export default function JobDetailPage() {
  const { orgId, role } = useAuth();
  const params = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const editMode = searchParams.get("edit") === "1";
  const canAnalyzeRole = hasRole(role, "analyst");
  const canReview = hasRole(role, "reviewer");
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [sampleCode, setSampleCode] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [overlayUrl, setOverlayUrl] = useState("");
  const [error, setError] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [aiNotice, setAiNotice] = useState("");
  const [calibrations, setCalibrations] = useState<Calibration[]>([]);
  const [editType, setEditType] = useState<AnalysisType>("grain_size");
  const [editCalibration, setEditCalibration] = useState("");
  const [editRunAi, setEditRunAi] = useState(true);
  const [editEtch, setEditEtch] = useState<"line" | "contrast">("line");
  const [editBusy, setEditBusy] = useState(false);

  // Reviewed / rejected jobs are signed off: only an admin may re-run or edit them (DB enforces too).
  const signedOff = job?.status === "reviewed" || job?.status === "rejected";
  const canAnalyze = canAnalyzeRole && (!signedOff || hasRole(role, "admin"));

  const applyJob = useCallback(async (data: AnalysisJob) => {
    setJob(data);
    setEditType(data.analysis_type);
    setEditCalibration(data.calibration_id ?? "");
    setEditRunAi(data.run_ai ?? true);
    setEditEtch(data.analysis_options?.etch === "contrast" ? "contrast" : "line");
    const [src, ov, sample, reviewer] = await Promise.all([
      signedUrl("job-images", data.source_image_path),
      signedUrl("job-overlays", data.overlay_image_path),
      supabase.from("samples").select("sample_code").eq("id", data.sample_id).maybeSingle(),
      data.reviewed_by
        ? supabase.from("user_profiles").select("full_name").eq("id", data.reviewed_by).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setSourceUrl(src);
    setOverlayUrl(ov);
    setSampleCode(String(sample.data?.sample_code ?? ""));
    setReviewerName(String((reviewer.data as { full_name?: string } | null)?.full_name ?? ""));
  }, []);

  const load = useCallback(async () => {
    if (!orgId || !params.id) return;
    const data = await fetchJob(params.id);
    if (!data) throw new Error("Job Not Found");
    await applyJob(data);
  }, [orgId, params.id, applyJob]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  useEffect(() => {
    if (editMode && orgId) fetchCalibrations(orgId).then(setCalibrations).catch(() => setCalibrations([]));
  }, [editMode, orgId]);

  async function retryAi() {
    if (!job || aiBusy) return;
    if (!job.source_image_path) {
      setError("Cannot Retry AI — Source Image Is Missing for This Job.");
      return;
    }
    setAiBusy(true);
    setError("");
    setAiNotice("Retrying AI analysis… This may take up to a minute.");
    try {
      await applyJob(await rerunAi(job.id));
      setAiNotice("AI analysis updated.");
    } catch (e) {
      setAiNotice("");
      setError(e instanceof Error ? e.message : "Retry Failed");
    } finally {
      setAiBusy(false);
    }
  }

  async function review(approve: boolean) {
    if (!job || reviewBusy) return;
    setReviewBusy(true);
    try {
      await reviewJob(job.id, approve, reviewNotes.trim() || (approve ? "Approved" : "Rejected"));
      setReviewNotes("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review Failed");
    } finally {
      setReviewBusy(false);
    }
  }

  async function saveEdit() {
    if (!job || editBusy) return;
    setEditBusy(true);
    setError("");
    try {
      await applyJob(
        await updateJobAndRerun(job.id, {
          analysis_type: editType,
          calibration_id: editCalibration || null,
          run_ai: editRunAi,
          analysis_options: editType === "grain_size" ? { etch: editEtch } : {},
        }),
      );
      setSearchParams({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update Failed");
    } finally {
      setEditBusy(false);
    }
  }

  async function downloadPdf() {
    if (!job || !orgId || pdfBusy) return;
    setPdfBusy(true);
    setError("");
    try {
      const [branding, sourceDataUrl, overlayDataUrl] = await Promise.all([
        loadLabBranding(orgId).catch(() => null),
        objectDataUrl("job-images", job.source_image_path),
        objectDataUrl("job-overlays", job.overlay_image_path),
      ]);
      const html = buildJobReportHtml({ job, sampleCode, branding, sourceDataUrl, overlayDataUrl, reviewerName });
      await downloadPdfViaPlaywright({ html, filename: `report-${job.id}.pdf`, format: "a4", margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF Failed");
    } finally {
      setPdfBusy(false);
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
          <Link to="/app/analysis?view=jobs" className="text-sm text-[var(--accent)] shrink-0">
            ← All Jobs
          </Link>
          <h1 className="page-title min-w-0">
            {ANALYSIS_LABELS[job.analysis_type]}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button className="btn btn-ghost" disabled={pdfBusy} onClick={downloadPdf} type="button">
            {pdfBusy ? "Preparing PDF…" : "Download PDF Report"}
          </button>
          {canAnalyze && (
            <button
              className="btn btn-primary"
              disabled={aiBusy || !job.source_image_path}
              onClick={retryAi}
              type="button"
            >
              {aiBusy ? "Retrying…" : "Retry AI Analysis"}
            </button>
          )}
          {canAnalyze && !editMode && (
            <button className="btn btn-ghost" onClick={() => setSearchParams({ edit: "1" })} type="button">
              Edit
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {aiNotice && !error && <p className="text-sm text-[var(--accent)]">{aiNotice}</p>}
      {job.error_message && (
        <p className="card p-4 text-sm text-[var(--danger)]">{job.error_message}</p>
      )}

      <div className="card p-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-[var(--muted)]">Sample:</span>
        <span className="font-medium">{sampleCode || "—"}</span>
        <span className="text-[var(--muted)] ml-4">Status:</span>
        <span className="font-medium">{formatStatus(job.status)}</span>
        {(job.status === "reviewed" || job.status === "rejected") && (
          <span className="text-[var(--muted)]">
            by {reviewerName || "Reviewer"}
            {job.reviewed_at ? ` on ${new Date(job.reviewed_at).toLocaleString()}` : ""}
            {job.review_notes ? ` — ${job.review_notes}` : ""}
          </span>
        )}
        {canReview && (
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <input
              className="input w-64"
              placeholder="Review Notes (optional)"
              aria-label="Review Notes"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
            />
            <button className="btn btn-ghost" disabled={reviewBusy} onClick={() => review(true)} type="button">
              Approve
            </button>
            <button className="btn btn-ghost" disabled={reviewBusy} onClick={() => review(false)} type="button">
              Reject
            </button>
          </div>
        )}
      </div>

      {editMode && canAnalyze && (
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold">Edit Job</h2>
          <p className="text-sm text-[var(--muted)]">
            Change the module, calibration or etch type and re-run the software analysis on the same image.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <label className="text-sm">
              <span className="text-xs text-[var(--muted)]">Analysis Module</span>
              <select className="input mt-1" value={editType} onChange={(e) => setEditType(e.target.value as AnalysisType)}>
                {(Object.keys(ANALYSIS_LABELS) as AnalysisType[]).map((t) => (
                  <option key={t} value={t}>
                    {ANALYSIS_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-xs text-[var(--muted)]">Calibration</span>
              <select className="input mt-1" value={editCalibration} onChange={(e) => setEditCalibration(e.target.value)}>
                <option value="">None (1 µm/px Default)</option>
                {calibrations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.objective} · {c.um_per_px_x} µm/px
                  </option>
                ))}
              </select>
            </label>
            {editType === "grain_size" && (
              <label className="text-sm">
                <span className="text-xs text-[var(--muted)]">Etch Type</span>
                <select className="input mt-1" value={editEtch} onChange={(e) => setEditEtch(e.target.value as "line" | "contrast")}>
                  <option value="line">Boundary Etch (lines)</option>
                  <option value="contrast">Contrast / Tint Etch (shades, beta)</option>
                </select>
              </label>
            )}
            <label className="text-sm flex items-end gap-2 pb-2">
              <input type="checkbox" checked={editRunAi} onChange={(e) => setEditRunAi(e.target.checked)} />
              Run AI Cross-Check
            </label>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={editBusy} onClick={saveEdit} type="button">
              {editBusy ? "Re-running…" : "Save & Re-run Analysis"}
            </button>
            <button className="btn btn-ghost" onClick={() => setSearchParams({})} type="button">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-4">
          <h2 className="font-semibold mb-3">Source Image</h2>
          {sourceUrl ? (
            <img
              src={sourceUrl}
              alt="Source"
              className="w-full border border-[var(--line)] bg-white object-contain max-h-[420px]"
            />
          ) : (
            <p className="text-sm text-[var(--muted)] py-8 text-center">No Source Image Available.</p>
          )}
        </div>
        <div className="card p-4">
          <h2 className="font-semibold mb-3">Software Overlay</h2>
          {overlayUrl ? (
            <img
              src={overlayUrl}
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
          <ResultExtras job={job} />
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
