import { Link } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import { Suspense, useState } from "react";
import {
  EMPTY_JOB_FILTERS,
  JobsFilterDropdown,
  type JobFilters,
} from "@/features/analysis/JobsFilterDropdown";
import { JobsList } from "@/features/analysis/JobsList";
import { ANALYSIS_LABELS, type AnalysisType } from "@/types";

function AnalysisContent() {
  const [params] = useSearchParams();
  const view = params.get("view") === "jobs" ? "jobs" : "modules";
  const type = (params.get("type") as AnalysisType) || "grain_size";
  const [jobFilters, setJobFilters] = useState<JobFilters>(EMPTY_JOB_FILTERS);

  const details: Record<AnalysisType, { standard: string; description: string }> = {
    grain_size: {
      standard: "ASTM E112-13 / ISO 643:2019",
      description:
        "Heyn Lineal Intercept (Primary) and Jeffries Planimetric Grain Size With Duplex Check (ASTM E1181). Calibrated on ASTM E112 Plates I-B and IV.",
    },
    inclusion: {
      standard: "ISO 4967:2013 / ASTM E45 Method A",
      description:
        "JK Chart Rating per 0.50 mm² Field: Types A, B, C, D Thin / Heavy and DS, Using the E45 Plate I-r Severity Limits.",
    },
    decarb: {
      standard: "ISO 3887:2017",
      description:
        "Metallographic Decarburization Depth From Free-Surface Edge Intensity Transition.",
    },
    micro: {
      standard: "Micro Analysis",
      description:
        "Light/Dark Phase Area Fractions, With a Lever-Rule Carbon Estimate for Slowly Cooled Ferrite–Pearlite Steel.",
    },
    macro: {
      standard: "IS 10138:2010",
      description:
        "Macroscopic Methods for Non-Metallic Inclusion Stringers ≥ 1 mm in Wrought Steels.",
    },
    nodularity: {
      standard: "ISO 945-4 / ASTM E2567 / A247",
      description:
        "Spheroidal Graphite Iron: Nodularity %, Nodule Count per mm² and A247 Nodule Size Class From Particle Roundness.",
    },
    graphite_flake: {
      standard: "ASTM A247 / ISO 945-1",
      description:
        "Grey Iron: Graphite Flake Size Class From the Longest Flakes, Graphite Area % and a Graphite Type Hint (A–E).",
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
          <Link to="/app/capture" className="btn btn-primary">
            New Analysis
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          className={`btn btn-ghost ${view === "modules" ? "border-[var(--accent)] text-[var(--accent)]" : ""}`}
          to="/app/analysis?view=modules"
        >
          Modules
        </Link>
        <Link
          className={`btn btn-ghost ${view === "jobs" ? "border-[var(--accent)] text-[var(--accent)]" : ""}`}
          to="/app/analysis?view=jobs"
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
                to={`/app/analysis?view=modules&type=${key}`}
                className={`card p-5 transition ${
                  key === type ? "ring-2 ring-[var(--accent)]" : "hover:border-[var(--accent)]"
                }`}
              >
                <div className="text-xs tracking-wide text-[var(--accent)] font-semibold">
                  {details[key].standard}
                </div>
                <h2 className="mt-2 font-semibold">{ANALYSIS_LABELS[key]}</h2>
              </Link>
            ))}
          </div>

          <div className="card p-6">
            <h2 className="text-xl font-semibold">{ANALYSIS_LABELS[type]}</h2>
            <p className="mt-2 text-[var(--muted)] max-w-3xl">{details[type].description}</p>
            <div className="mt-5 flex gap-3">
              <Link to={`/app/capture?type=${type}`} className="btn btn-primary">
                Capture / Upload for {ANALYSIS_LABELS[type]}
              </Link>
              <Link to="/app/analysis?view=jobs" className="btn btn-ghost">
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
