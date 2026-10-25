import { Link, useParams, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { hasRole } from "@/lib/roles";
import { formatStatus } from "@/lib/text";
import { supabase } from "@/lib/supabaseClient";
import { objectDataUrl, signedUrl } from "@/lib/storage";
import { downloadPdfViaPlaywright } from "@/lib/playwrightPdfClient";
import { ANALYSIS_LABELS, type AnalysisJob, type AnalysisType, type Calibration } from "@/types";
import { fetchJob, reviewJob, updateJobAndRerun } from "@/features/analysis/analysisApi";
import { fetchCalibrations } from "@/features/calibrations/calibrationsApi";
import { loadLabBranding } from "@/features/settings/labSettingsApi";
import { buildJobReportHtml } from "@/features/analysis/buildJobReportHtml";
import { ResultExtras } from "@/features/analysis/ResultExtras";
import { formatResult, formatRowValue } from "@/features/analysis/resultFormat";
import { X } from "lucide-react";

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
  const [reviewBusy, setReviewBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [calibrations, setCalibrations] = useState<Calibration[]>([]);
  const [editType, setEditType] = useState<AnalysisType>("grain_size");
  const [editCalibration, setEditCalibration] = useState("");
  const [editEtch, setEditEtch] = useState<"line" | "contrast">("line");
  const [editBusy, setEditBusy] = useState(false);
  const [zoom, setZoom] = useState<"" | "source" | "overlay">("");

  // Reviewed / rejected jobs are signed off: only an admin may re-run or edit them (DB enforces too).
  const signedOff = job?.status === "reviewed" || job?.status === "rejected";
  const canAnalyze = canAnalyzeRole && (!signedOff || hasRole(role, "admin"));

  const applyJob = useCallback(async (data: AnalysisJob) => {
    setJob(data);
    setEditType(data.analysis_type);
    setEditCalibration(data.calibration_id ?? "");
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

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom("");
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  if (!job) {
    return <div className="text-[var(--muted)]">{error || "Loading Job…"}</div>;
  }

  const fr = formatResult(job.analysis_type, job.software_result);
  const statusBadge =
    job.status === "reviewed" ? "badge-ok" : job.status === "rejected" || job.status === "failed" ? "badge-danger" : job.status === "completed" ? "badge-warn" : "badge-muted";
  const zoomUrl = zoom === "source" ? sourceUrl : zoom === "overlay" ? overlayUrl : "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0">
          <Link to="/app/analysis?view=jobs" className="text-sm text-[var(--accent)] shrink-0">
            ← All Jobs
          </Link>
          <h1 className="page-title min-w-0">{ANALYSIS_LABELS[job.analysis_type]}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button className="btn btn-ghost" disabled={pdfBusy} onClick={downloadPdf} type="button">
            {pdfBusy ? "Preparing PDF…" : "Download PDF"}
          </button>
          {canAnalyze && !editMode && (
            <button className="btn btn-ghost" onClick={() => setSearchParams({ edit: "1" })} type="button">
              Edit
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {job.error_message && <p className="card p-4 text-sm text-[var(--danger)]">{job.error_message}</p>}

      <div className="card px-4 py-3 flex flex-wrap lg:flex-nowrap items-center gap-x-5 gap-y-3 text-sm">
        <div className="flex items-center gap-2 shrink-0">
          <span className="label !mb-0">Sample</span>
          <span className="font-semibold">{sampleCode || "—"}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="label !mb-0">Status</span>
          <span className={`badge ${statusBadge}`}>{formatStatus(job.status)}</span>
        </div>
        {signedOff && (
          <span className="text-xs text-[var(--muted)] min-w-0 truncate" title={job.review_notes ?? ""}>
            {reviewerName || "Reviewer"}
            {job.reviewed_at ? ` · ${new Date(job.reviewed_at).toLocaleDateString()}` : ""}
            {job.review_notes ? ` · ${job.review_notes}` : ""}
          </span>
        )}
        {canReview && (
          <div className="flex flex-1 flex-wrap sm:flex-nowrap items-center gap-2 min-w-[min(100%,18rem)] lg:justify-end">
            <input
              className="input flex-1 min-w-0 lg:max-w-md"
              placeholder="Review Notes"
              aria-label="Review Notes"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
            />
            <button className="btn btn-primary shrink-0" disabled={reviewBusy} onClick={() => review(true)} type="button">
              Approve
            </button>
            <button className="btn btn-danger shrink-0" disabled={reviewBusy} onClick={() => review(false)} type="button">
              Reject
            </button>
          </div>
        )}
      </div>

      {editMode && canAnalyze && (
        <div className="card p-5 space-y-4">
          <h2 className="section-title">Edit Job</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <label className="text-sm">
              <span className="label">Analysis Module</span>
              <select className="input mt-1" value={editType} onChange={(e) => setEditType(e.target.value as AnalysisType)}>
                {(Object.keys(ANALYSIS_LABELS) as AnalysisType[]).map((t) => (
                  <option key={t} value={t}>
                    {ANALYSIS_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="label">Calibration</span>
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
                <span className="label">Etch Type</span>
                <select className="input mt-1" value={editEtch} onChange={(e) => setEditEtch(e.target.value as "line" | "contrast")}>
                  <option value="line">Boundary Etch (lines)</option>
                  <option value="contrast">Contrast / Tint Etch (shades, beta)</option>
                </select>
              </label>
            )}
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

      <div className="grid lg:grid-cols-2 gap-5">
        {([
          ["source", "Source Image", sourceUrl],
          ["overlay", "Software Overlay", overlayUrl],
        ] as const).map(([key, title, url]) => (
          <div key={key} className="card p-4 flex flex-col">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="section-title !mb-0">{title}</h2>
              {url && (
                <button type="button" className="text-xs text-[var(--accent)]" onClick={() => setZoom(key)}>
                  Enlarge
                </button>
              )}
            </div>
            {url ? (
              <button type="button" className="block cursor-zoom-in" onClick={() => setZoom(key)} aria-label={`Enlarge ${title}`}>
                <img src={url} alt={title} className="w-full h-[min(60vh,440px)] object-contain border border-[var(--line)] bg-[var(--bg)]" />
              </button>
            ) : (
              <p className="text-sm text-[var(--muted)] py-8 text-center">No Image</p>
            )}
            {key === "overlay" && fr.legend.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                {fr.legend.map((l) => (
                  <span key={l.label} className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5" style={{ background: l.color }} />
                    {l.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card p-5 space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="section-title !mb-0">Software Analysis</h2>
          {fr.standard && <span className="text-xs text-[var(--muted)]">{fr.standard}</span>}
        </div>

        {fr.headline.length > 0 ? (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {fr.headline.map((h) => (
              <div key={h.label} className="border border-[var(--line)] bg-[var(--bg)] px-4 py-3 min-w-0">
                <div className="text-xs text-[var(--muted)] truncate">{h.label}</div>
                <div className="mt-1 text-2xl font-semibold leading-tight text-[var(--ink)] break-words">
                  {h.value}
                  {h.unit && <span className="ml-1 text-sm font-normal text-[var(--muted)]">{h.unit}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">No Result</p>
        )}

        {fr.warnings.map((w) => (
          <p key={w} className="border-l-4 border-[var(--warn)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-3 py-2 text-sm">
            {w}
          </p>
        ))}

        {job.analysis_type === "inclusion" && <ResultExtras job={job} />}

        {fr.details.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table-grid w-full text-sm">
              <tbody>
                {fr.details.map((d) => (
                  <tr key={d.label}>
                    <th scope="row" className="w-1/2 px-3 py-2 text-left font-normal text-[var(--muted)]">{d.label}</th>
                    <td className="px-3 py-2 font-medium">{formatRowValue(d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(fr.method || fr.notes) && (
          <details className="text-sm">
            <summary className="cursor-pointer text-[var(--accent)]">Method</summary>
            <div className="mt-2 space-y-1 text-[var(--muted)]">
              {fr.method && <p className="capitalize">{fr.method}</p>}
              {fr.notes && <p>{fr.notes}</p>}
            </div>
          </details>
        )}
      </div>

      {zoomUrl && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={() => setZoom("")} role="dialog" aria-modal="true">
          <button type="button" className="absolute top-3 right-3 text-white p-2" aria-label="Close" onClick={() => setZoom("")}>
            <X size={24} />
          </button>
          <img src={zoomUrl} alt="" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
