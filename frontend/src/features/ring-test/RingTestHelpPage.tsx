import { RingTestShell } from "@/features/ring-test/RingTestNav";

export default function RingTestHelpPage() {
  return (
    <RingTestShell title="Help">
      <div className="card max-w-3xl space-y-5 p-5">
        {[
          [
            "1. Sample Information",
            "Enter Sample Description, Sample Diameter (mm), Batch Number, and MFG Date, then click Do Analysis.",
          ],
          [
            "2. Capture Image",
            "Upload a cut-face photo of the ribbed bar or use the camera. Place a ruler in-frame when possible for scale calibration.",
          ],
          [
            "3. Calibrate Scale (mm/px)",
            "Draw a calibration line on a known length, enter the length in millimetres, and apply.",
          ],
          [
            "4. Place Rings",
            "Mark the Inner Ring (core / F&P) and Outer Ring (rib envelope). Use Auto Detect when contrast is clear, then fine-tune by dragging.",
          ],
          [
            "5. Thickness Points",
            "Enable thickness markers t1–t8 at the standard IS 1786 angles. Each rib thickness must fall within 0.07d–0.15d, and TM area share must be 30–50% for an overall PASS.",
          ],
          [
            "6. Save & Report",
            "Open Results, review PASS/FAIL, enter Operator Name and Observation, then Save. Open the report later from Reports for Print / PDF.",
          ],
        ].map(([title, body]) => (
          <section key={title} className="space-y-1">
            <h2 className="text-sm font-bold uppercase tracking-wide text-blue-300">{title}</h2>
            <p className="text-sm leading-relaxed text-slate-300">{body}</p>
          </section>
        ))}
      </div>
    </RingTestShell>
  );
}
