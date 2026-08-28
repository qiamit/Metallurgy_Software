"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ANALYSIS_LABELS, type AnalysisType, type JobStatus } from "@/lib/types";

export type JobFilters = {
  query: string;
  module: AnalysisType | "";
  status: JobStatus | "";
  agreement: string;
};

export const EMPTY_JOB_FILTERS: JobFilters = {
  query: "",
  module: "",
  status: "",
  agreement: "",
};

type JobsFilterDropdownProps = {
  filters: JobFilters;
  onChange: (filters: JobFilters) => void;
};

export function JobsFilterDropdown({ filters, onChange }: JobsFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeCount = [
    filters.query.trim(),
    filters.module,
    filters.status,
    filters.agreement,
  ].filter(Boolean).length;

  function update<K extends keyof JobFilters>(key: K, value: JobFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function clearFilters() {
    onChange(EMPTY_JOB_FILTERS);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        aria-expanded={open}
        className={`btn btn-ghost flex items-center gap-2 ${activeCount ? "border-[var(--accent)] text-[var(--accent)]" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        Search & Filter Jobs
        {activeCount > 0 && (
          <span className="text-xs px-1.5 py-0.5 border border-[var(--accent)]">{activeCount}</span>
        )}
        <ChevronDown className={`transition-transform ${open ? "rotate-180" : ""}`} size={16} />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-[min(420px,calc(100vw-2rem))] border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-lg)] p-4 space-y-4">
          <div>
            <label className="text-xs text-[var(--muted)]">Search Jobs</label>
            <input
              className="input mt-1"
              placeholder="Module, status, date, job id…"
              value={filters.query}
              onChange={(e) => update("query", e.target.value)}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[var(--muted)]">Module</label>
              <select
                className="input mt-1"
                value={filters.module}
                onChange={(e) => update("module", e.target.value as AnalysisType | "")}
              >
                <option value="">All Modules</option>
                {(Object.keys(ANALYSIS_LABELS) as AnalysisType[]).map((key) => (
                  <option key={key} value={key}>
                    {ANALYSIS_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--muted)]">Status</label>
              <select
                className="input mt-1"
                value={filters.status}
                onChange={(e) => update("status", e.target.value as JobStatus | "")}
              >
                <option value="">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="reviewed">Reviewed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-[var(--muted)]">AI Agreement</label>
              <select
                className="input mt-1"
                value={filters.agreement}
                onChange={(e) => update("agreement", e.target.value)}
              >
                <option value="">All Agreements</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={clearFilters} type="button">
              Clear
            </button>
            <button className="btn btn-primary" onClick={() => setOpen(false)} type="button">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
