"use client";

import { useEffect, useState } from "react";
import { RingTestShell } from "@/components/ring-test/RingTestNav";
import { RingTestWorkflow } from "@/components/ring-test/RingTestWorkflow";
import {
  DEFAULT_RING_SETTINGS,
  loadRingSettings,
  type RingSettings,
} from "@/lib/ring-test/settings";

export default function RingTestPage() {
  const [settings, setSettings] = useState<RingSettings>(DEFAULT_RING_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSettings(loadRingSettings());
    setReady(true);
  }, []);

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
            aiAnalysisEnabled: false,
          }}
        />
      ) : (
        <p className="text-sm text-[var(--rt-muted)]">Loading editor…</p>
      )}
    </RingTestShell>
  );
}
