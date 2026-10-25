import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { hasRole } from "@/lib/roles";
import { RingTestShell } from "@/features/ring-test/RingTestNav";
import {
  DEFAULT_RING_SETTINGS,
  loadRingSettings,
  saveRingSettings,
  type RingSettings,
} from "@/features/ring-test/settings";

export default function RingTestSettingsPage() {
  const [form, setForm] = useState<RingSettings>(DEFAULT_RING_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const { orgId, role } = useAuth();
  const canSave = hasRole(role, "analyst");

  useEffect(() => {
    if (orgId) loadRingSettings(orgId).then(setForm);
  }, [orgId]);

  function update<K extends keyof RingSettings>(key: K, value: RingSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function onSave() {
    if (!orgId) return;
    setSaveError("");
    try {
      await saveRingSettings(orgId, form);
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    }
  }

  return (
    <RingTestShell title="Settings">
      <div className="card max-w-3xl space-y-5 p-4 sm:p-5">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Calibration</h2>
          <label className="block">
            <span className="label mb-1 block">mm/px Override (optional)</span>
            <input
              className="input"
              type="number"
              step="0.0001"
              value={form.mm_per_px_override ?? ""}
              onChange={(e) =>
                update(
                  "mm_per_px_override",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              placeholder="Leave blank to use on-image calibration"
            />
          </label>
          <label className="block">
            <span className="label mb-1 block">Angular Correction (°)</span>
            <input
              className="input"
              type="number"
              step="0.1"
              value={form.angular_correction_deg}
              onChange={(e) => update("angular_correction_deg", Number(e.target.value) || 0)}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label mb-1 block">Thickness Outer Gap (px)</span>
              <input
                className="input"
                type="number"
                value={form.thickness_outer_gap_px}
                onChange={(e) => update("thickness_outer_gap_px", Number(e.target.value) || 0)}
              />
            </label>
            <label className="block">
              <span className="label mb-1 block">Thickness Inner Gap (px)</span>
              <input
                className="input"
                type="number"
                value={form.thickness_inner_gap_px}
                onChange={(e) => update("thickness_inner_gap_px", Number(e.target.value) || 0)}
              />
            </label>
          </div>
        </section>

        <section className="space-y-3 border-t border-[var(--rt-border)] pt-4">
          <h2 className="text-sm font-semibold text-white">Drawing Colors</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["inner_color", "Inner"],
                ["outer_color", "Outer"],
                ["diam_color", "Diameter"],
                ["thick_color", "Thickness"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block">
                <span className="label mb-1 block">{label}</span>
                <input
                  className="input h-10 p-1"
                  type="color"
                  value={form[key]}
                  onChange={(e) => update(key, e.target.value)}
                />
              </label>
            ))}
          </div>
        </section>

        <div className="flex items-center gap-3 border-t border-[var(--rt-border)] pt-4">
          <button type="button" className="btn-primary" onClick={onSave} disabled={!canSave}>
            Save Settings
          </button>
          {saved ? <span className="text-sm text-green-400">Saved for this lab.</span> : null}
          {saveError ? <span className="text-sm text-red-400">{saveError}</span> : null}
        </div>
      </div>
    </RingTestShell>
  );
}
