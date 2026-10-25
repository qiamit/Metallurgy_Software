import { esc, wrapLabReport } from "@/lib/reportHtml";
import type { LabBranding } from "@/features/settings/labSettingsApi";
import type { RingTestRecord } from "@/features/ring-test/types";

const f = (v: number | null | undefined, d: number) => (v == null ? "—" : v.toFixed(d));

/** Ring Test Certificate (IS 1786:2008) with the lab's branding, rendered by the PDF service. */
export function buildRingCertificateHtml(record: RingTestRecord, branding: LabBranding | null, imageDataUrl: string) {
  const r = record.results;
  const pass = r?.overall_pass;
  const fields: [string, string][] = [
    ["Sample Description", record.sample_description || "—"],
    ["Sample Diameter", `${record.sample_diameter_mm} mm`],
    ["Batch Number", record.batch_number || "—"],
    ["MFG Date", record.mfg_date || "—"],
    ["Operator", record.tester_name],
    ["Test Date / Time", `${record.test_date} ${record.test_time}`],
  ];
  const thickness = (r?.thickness_measurements ?? [])
    .map(
      (t) =>
        `<tr><td>${esc(t.label)}</td><td>${esc(t.rib_core ? `${t.angle_deg} (core)` : t.rib_shift_deg ? `${t.angle_deg + t.rib_shift_deg}` : t.angle_deg)}</td><td>${f(t.thickness_mm, 3)}${t.uncertain ? " *" : ""}</td></tr>`,
    )
    .join("");
  const body = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div class="sub" style="text-transform:uppercase;font-weight:700">Ring Test Certificate</div>
        <h1>IS 1786:2008 Rib Measurement</h1>
      </div>
      <span class="pill ${pass == null ? "neutral" : pass ? "pass" : "fail"}">${pass == null ? "—" : pass ? "PASS" : "FAIL"}</span>
    </div>
    <table class="meta" style="margin:8px 0">
      ${fields.map(([k, v]) => `<tr><td style="width:150px"><b>${esc(k)}:</b></td><td>${esc(v)}</td></tr>`).join("")}
    </table>
    ${
      r
        ? `<h2>Thickness Measurements (t1–t8)</h2>
      <table><thead><tr><th>Point</th><th>Angle (°)</th><th>Thickness (mm)</th></tr></thead><tbody>${thickness}</tbody></table>
      <table class="meta" style="margin-top:6px">
        <tr><td style="width:150px"><b>Min / Max / Mean:</b></td><td>${f(r.thickness_min_mm, 3)} / ${f(r.thickness_max_mm, 3)} / ${f(r.thickness_mean_mm, 3)} mm</td></tr>
        <tr><td><b>Allowed Range:</b></td><td>${f(r.thickness_range_low_mm, 3)} – ${f(r.thickness_range_high_mm, 3)} mm (0.07d–0.15d)</td></tr>
        <tr><td><b>Thickness In Range:</b></td><td>${r.thickness_in_range ? "Yes" : "No"}</td></tr>
      </table>
      <h2>Area Share</h2>
      <table class="meta">
        <tr><td style="width:150px"><b>TM Area:</b></td><td>${f(r.area_tm_mm2, 2)} mm²</td></tr>
        <tr><td><b>F&amp;P Area:</b></td><td>${f(r.area_fp_mm2, 2)} mm²</td></tr>
        <tr><td><b>TM Fraction:</b></td><td>${f(r.tm_area_fraction_percent, 1)}% (required 30–50%)</td></tr>
      </table>
      ${
        r.equivalent_diameter_mm != null
          ? `<h2>Geometry</h2>
      <table class="meta">
        <tr><td style="width:150px"><b>Measured / Equivalent Ø:</b></td><td>${f(r.measured_diameter_mm, 2)} / ${f(r.equivalent_diameter_mm, 2)} mm</td></tr>
        <tr><td><b>Concentricity:</b></td><td>${f(r.concentricity_mm, 3)} mm</td></tr>
        <tr><td><b>Thickness Spread:</b></td><td>${f(r.thickness_spread_mm, 3)} mm</td></tr>
      </table>
      ${(r.warnings ?? []).length ? `<p style="font-size:9px;color:#92400e">${(r.warnings ?? []).map(esc).join("<br/>")}</p>` : ""}`
          : ""
      }`
        : ""
    }
    ${record.observations ? `<h2>Observations</h2><p style="white-space:pre-wrap">${esc(record.observations)}</p>` : ""}
    ${
      imageDataUrl
        ? `<h2>Annotated Image</h2><img src="${imageDataUrl}" alt="" style="max-width:100%;max-height:110mm;border:1px solid #c5d0d4" />
      <div style="display:flex;gap:12px;font-size:9px;margin-top:3px">${[
        ["#f472b6", "Outer"],
        ["#fde047", "Inner"],
        ["#fb923c", "Diameter"],
        ["#4ade80", "Thickness"],
        ["#ef4444", "Low-contrast edge"],
      ]
        .map(([c, l]) => `<span><i style="display:inline-block;width:8px;height:8px;background:${c};margin-right:3px"></i>${l}</span>`)
        .join("")}</div>`
        : ""
    }`;
  return wrapLabReport(branding, `Ring Test ${record.id}`, body);
}
