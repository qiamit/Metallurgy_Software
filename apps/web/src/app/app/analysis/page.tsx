"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ANALYSIS_LABELS, type AnalysisType } from "@/lib/types";

function AnalysisContent() {
  const params = useSearchParams();
  const type = (params.get("type") as AnalysisType) || "grain_size";

  const details: Record<AnalysisType, { standard: string; description: string }> = {
    grain_size: {
      standard: "ISO 643:2019",
      description:
        "Micrographic determination of apparent grain size using intercept and planimetric estimates with boundary overlays.",
    },
    inclusion: {
      standard: "ISO 4967:1998",
      description:
        "Non-metallic inclusion rating via particle segmentation and type A/B/C/D/DS heuristics compared to chart indices.",
    },
    decarb: {
      standard: "ISO 3887:2017",
      description:
        "Metallographic decarburization depth from free-surface edge intensity transition.",
    },
    micro: {
      standard: "Micro Analysis",
      description:
        "Field microstructure statistics including light/dark phase area fractions.",
    },
    macro: {
      standard: "IS 10138:2010",
      description:
        "Macroscopic methods for non-metallic inclusion stringers ≥ 1 mm in wrought steels.",
    },
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Analysis modules</h1>
        <p className="text-[var(--muted)] mt-1">
          Software analysis is primary. AI comparison is available as an advisory check.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {(Object.keys(ANALYSIS_LABELS) as AnalysisType[]).map((key) => (
          <Link
            key={key}
            href={`/app/analysis?type=${key}`}
            className={`card p-5 transition ${
              key === type ? "ring-2 ring-[var(--accent)]" : "hover:border-[var(--accent)]"
            }`}
          >
            <div className="text-xs uppercase tracking-wide text-[var(--accent)]">
              {details[key].standard}
            </div>
            <h2 className="mt-2 font-semibold">{ANALYSIS_LABELS[key]}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{details[key].description}</p>
          </Link>
        ))}
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-semibold">{ANALYSIS_LABELS[type]}</h2>
        <p className="mt-2 text-[var(--muted)] max-w-3xl">{details[type].description}</p>
        <div className="mt-5 flex gap-3">
          <Link href={`/app/capture`} className="btn btn-primary">
            Capture / upload for {ANALYSIS_LABELS[type]}
          </Link>
          <Link href="/app/jobs" className="btn btn-ghost">
            Browse previous jobs
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div>Loading modules…</div>}>
      <AnalysisContent />
    </Suspense>
  );
}
