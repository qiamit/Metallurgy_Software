import { Link } from "react-router-dom";
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { RingTestShell } from "@/features/ring-test/RingTestNav";
import { getRingTest } from "@/features/ring-test/ringTestApi";
import type { RingTestRecord } from "@/features/ring-test/types";
import { useAuth } from "@/hooks/useAuth";
import { objectDataUrl, signedUrl } from "@/lib/storage";
import { downloadPdfViaPlaywright } from "@/lib/playwrightPdfClient";
import { loadLabBranding } from "@/features/settings/labSettingsApi";
import { buildRingCertificateHtml } from "@/features/ring-test/buildRingCertificateHtml";

export default function RingTestReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { orgId } = useAuth();
  const [record, setRecord] = useState<RingTestRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");

  useEffect(() => {
    if (!orgId || !id) return;
    void getRingTest(id)
      .then(async (rec) => {
        setRecord(rec);
        setImageUrl(await signedUrl("ring-test-images", rec.image_path));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [orgId, id]);

  async function downloadPdf() {
    if (!record || !orgId) return;
    setPdfBusy(true);
    setPdfError("");
    try {
      const [branding, image] = await Promise.all([
        loadLabBranding(orgId).catch(() => null),
        objectDataUrl("ring-test-images", record.image_path),
      ]);
      await downloadPdfViaPlaywright({
        html: buildRingCertificateHtml(record, branding, image),
        filename: `ring-test-${record.id}.pdf`,
        format: "a4",
      });
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : "PDF failed");
    } finally {
      setPdfBusy(false);
    }
  }

  if (error) {
    return (
      <RingTestShell title="Report">
        <p className="text-red-300">{error}</p>
        <Link to="/app/ring-test/reports" className="btn-ghost mt-3 inline-flex text-xs">
          ← Back to Reports
        </Link>
      </RingTestShell>
    );
  }

  if (!record) {
    return (
      <RingTestShell title="Report">
        <p className="text-sm text-[var(--rt-muted)]">Loading…</p>
      </RingTestShell>
    );
  }

  const r = record.results;
  const pass = r?.overall_pass;

  return (
    <RingTestShell title="Ring Test Report">
      <div className="no-print mb-3 flex gap-2">
        <Link to="/app/ring-test/reports" className="btn-ghost text-xs">
          ← Reports
        </Link>
        <button type="button" className="btn-primary text-xs" onClick={downloadPdf} disabled={pdfBusy}>
          {pdfBusy ? "Preparing PDF…" : "Download PDF"}
        </button>
        <button type="button" className="btn-ghost text-xs" onClick={() => window.print()}>
          Print
        </button>
        {pdfError && <span className="text-xs text-red-300">{pdfError}</span>}
      </div>

      <div className="card space-y-5 p-5 print:border-0 print:bg-white print:text-black">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--rt-border)] pb-4 print:border-slate-300">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--rt-muted)] print:text-slate-500">
              Ring Test Certificate
            </div>
            <div className="mt-1 text-xl font-bold text-white print:text-slate-900">
              IS 1786:2008 Rib Measurement
            </div>
          </div>
          <span className={pass ? "pill-pass" : "pill-fail"}>{pass ? "PASS" : "FAIL"}</span>
        </header>

        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Sample Description", record.sample_description || "—"],
            ["Sample Diameter", `${record.sample_diameter_mm} mm`],
            ["Batch Number", record.batch_number || "—"],
            ["MFG Date", record.mfg_date || "—"],
            ["Operator", record.tester_name],
            ["Test Date / Time", `${record.test_date} ${record.test_time}`],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-bold uppercase tracking-wide text-[var(--rt-muted)] print:text-slate-500">
                {label}
              </dt>
              <dd className="mt-0.5 font-semibold text-white print:text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>

        {r && (
          <>
            <section>
              <h2 className="mb-2 border-b border-blue-500/30 pb-1 text-sm font-bold uppercase tracking-wide text-blue-300 print:text-blue-800">
                Thickness Measurements (t1–t8)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full border border-[var(--rt-border)] text-sm print:border-slate-300">
                  <thead>
                    <tr className="bg-[var(--rt-surface-2)] print:bg-slate-100">
                      <th className="border border-[var(--rt-border)] px-2 py-1.5 text-left print:border-slate-300">
                        Point
                      </th>
                      <th className="border border-[var(--rt-border)] px-2 py-1.5 text-left print:border-slate-300">
                        Angle (°)
                      </th>
                      <th className="border border-[var(--rt-border)] px-2 py-1.5 text-left print:border-slate-300">
                        Thickness (mm)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(r.thickness_measurements || []).map((t) => (
                      <tr key={t.label}>
                        <td className="border border-[var(--rt-border)] px-2 py-1 print:border-slate-300">
                          {t.label}
                        </td>
                        <td className="border border-[var(--rt-border)] px-2 py-1 print:border-slate-300">
                          {t.angle_deg}
                        </td>
                        <td className="border border-[var(--rt-border)] px-2 py-1 font-mono print:border-slate-300">
                          {t.thickness_mm != null ? t.thickness_mm.toFixed(3) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <div className="text-xs font-bold uppercase text-[var(--rt-muted)]">Min / Max / Mean</div>
                  <div className="font-semibold">
                    {r.thickness_min_mm?.toFixed(3) ?? "—"} / {r.thickness_max_mm?.toFixed(3) ?? "—"} /{" "}
                    {r.thickness_mean_mm?.toFixed(3) ?? "—"} mm
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase text-[var(--rt-muted)]">Allowed Range</div>
                  <div className="font-semibold">
                    {r.thickness_range_low_mm?.toFixed(3) ?? "—"} –{" "}
                    {r.thickness_range_high_mm?.toFixed(3) ?? "—"} mm (0.07d–0.15d)
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase text-[var(--rt-muted)]">Thickness In Range</div>
                  <div className="font-semibold">{r.thickness_in_range ? "Yes" : "No"}</div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-2 border-b border-blue-500/30 pb-1 text-sm font-bold uppercase tracking-wide text-blue-300 print:text-blue-800">
                Area Share
              </h2>
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <div className="text-xs font-bold uppercase text-[var(--rt-muted)]">TM Area</div>
                  <div className="font-semibold">{r.area_tm_mm2?.toFixed(2) ?? "—"} mm²</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase text-[var(--rt-muted)]">F&amp;P Area</div>
                  <div className="font-semibold">{r.area_fp_mm2?.toFixed(2) ?? "—"} mm²</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase text-[var(--rt-muted)]">TM Fraction</div>
                  <div className="font-semibold">
                    {r.tm_area_fraction_percent?.toFixed(1) ?? "—"}%{" "}
                    <span className="font-normal text-[var(--rt-muted)]">(required 30–50%)</span>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {record.observations && (
          <section>
            <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-blue-300">Observations</h2>
            <p className="whitespace-pre-wrap text-sm">{record.observations}</p>
          </section>
        )}

        {imageUrl && (
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-blue-300">
              Annotated Image
            </h2>
            <img
              src={imageUrl}
              alt="Ring test annotated"
              className="max-w-full border border-[var(--rt-border)] bg-[var(--rt-surface-2)]"
            />
          </section>
        )}
      </div>
    </RingTestShell>
  );
}
