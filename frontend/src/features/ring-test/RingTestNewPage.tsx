import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { RingTestShell } from "@/features/ring-test/RingTestNav";
import { RingTestWorkflow } from "@/features/ring-test/RingTestWorkflow";
import {
  DEFAULT_RING_SETTINGS,
  loadRingSettings,
  type RingSettings,
} from "@/features/ring-test/settings";

export default function RingTestPage() {
  const [settings, setSettings] = useState<RingSettings>(DEFAULT_RING_SETTINGS);
  const [ready, setReady] = useState(false);
  const { orgId } = useAuth();

  useEffect(() => {
    if (!orgId) return;
    let canceled = false;
    loadRingSettings(orgId).then((s) => {
      if (canceled) return;
      setSettings(s);
      setReady(true);
    });
    return () => {
      canceled = true;
    };
  }, [orgId]);

  return (
    <RingTestShell title="New Test">
      {ready ? (
        <RingTestWorkflow
          key={JSON.stringify(settings)}
          defaults={{
            mmPerPxOverride: settings.mm_per_px_override,
            angularCorrectionDeg: settings.angular_correction_deg,
            thicknessOuterGapPx: settings.thickness_outer_gap_px,
            thicknessInnerGapPx: settings.thickness_inner_gap_px,
            units: "mm",
            style: {
              inner: { color: settings.inner_color, width: settings.inner_width },
              outer: { color: settings.outer_color, width: settings.outer_width },
              diam: { color: settings.diam_color, width: settings.diam_width },
              thick: { color: settings.thick_color, width: settings.thick_width },
            },
          }}
        />
      ) : (
        <p className="text-sm text-[var(--rt-muted)]">Loading editor…</p>
      )}
    </RingTestShell>
  );
}
