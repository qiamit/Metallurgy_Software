"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  EMPTY_JOB_FILTERS,
  JobsFilterDropdown,
  type JobFilters,
} from "@/components/JobsFilterDropdown";
import { JobsList } from "@/components/JobsList";
import { ANALYSIS_LABELS, type AnalysisType } from "@/lib/types";

function AnalysisContent() {
  const params = useSearchParams();
  const view = params.get("view") === "jobs" ? "jobs" : "modules";
  const type = (params.get("type") as AnalysisType) || "grain_size";
  const [jobFilters, setJobFilters] = useState<JobFilters>(EMPTY_JOB_FILTERS);

  const details: Record<AnalysisType, { standard: string; description: string }> = {
    grain_size: {
      standard: "ISO 643:2019",
      description:
        "Micrographic Determination of Apparent Grain Size Using Intercept and Planimetric Estimates With Boundary Overlays.",
    },
    inclusion: {
      standard: "ISO 4967:1998",
      description:
        "Non-Metallic Inclusion Rating via Particle Segmentation and Type A/B/C/D/DS Heuristics Compared to Chart Indices.",
    },
    decarb: {
      standard: "ISO 3887:2017",
      description:
        "Metallographic Decarburization Depth From Free-Surface Edge Intensity Transition.",
    },
    micro: {
      standard: "Micro Analysis",
      description:
        "Field Microstructure Statistics Including Light/Dark Phase Area Fractions.",
    },
    macro: {
      standard: "IS 10138:2010",
      description:
        "Macroscopic Methods for Non-Metallic Inclusion Stringers ≥ 1 mm in Wrought Steels.",
    },
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <h1 className="page-title">Analysis & Jobs</h1>
          {view === "jobs" && (
            <JobsFilterDropdown filters={jobFilters} onChange={setJobFilters} />
          )}
        </div>
        {view === "jobs" && (
          <Link href="/app/capture" className="btn btn-primary">
            New Analysis
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          className={`btn btn-ghost ${view === "modules" ? "border-[var(--accent)] text-[var(--accent)]" : ""}`}
          href="/app/analysis?view=modules"
        >
          Modules
        </Link>
        <Link
          className={`btn btn-ghost ${view === "jobs" ? "border-[var(--accent)] text-[var(--accent)]" : ""}`}
          href="/app/analysis?view=jobs"
        >
          Jobs & Compare
        </Link>
      </div>

      {view === "jobs" ? (
        <JobsList filters={jobFilters} />
      ) : (
        <>
          <div className="grid lg:grid-cols-3 gap-4">
            {(Object.keys(ANALYSIS_LABELS) as AnalysisType[]).map((key) => (
              <Link
                key={key}
                href={`/app/analysis?view=modules&type=${key}`}
                className={`card p-5 transition ${
                  key === type ? "ring-2 ring-[var(--accent)]" : "hover:border-[var(--accent)]"
                }`}
              >
                <div className="text-xs tracking-wide text-[var(--accent)] font-semibold">
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
              <Link href="/app/capture" className="btn btn-primary">
                Capture / Upload for {ANALYSIS_LABELS[type]}
              </Link>
              <Link href="/app/analysis?view=jobs" className="btn btn-ghost">
                Browse Previous Jobs
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <AnalysisContent />
    </Suspense>
  );
}
