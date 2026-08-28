"use client";

import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ElementDetailPanel } from "@/components/ElementDetailPanel";
import { ELEMENT_BY_SYMBOL, STP_TEMP_C } from "@/lib/periodicTable";

export default function ElementDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const symbol = String(params.symbol ?? "").toLowerCase();
  const element = ELEMENT_BY_SYMBOL.get(symbol);

  const tempC = useMemo(() => {
    const raw = Number(searchParams.get("temp"));
    return Number.isFinite(raw) ? Math.round(raw) : STP_TEMP_C;
  }, [searchParams]);

  if (!element) {
    return (
      <div className="pt-element-detail-page card">
        <h1 className="page-title">Element Not Found</h1>
        <p className="text-[var(--muted)]">No element matches symbol &ldquo;{symbol}&rdquo;.</p>
        <Link href="/app/periodic-table" className="btn btn-primary mt-4 inline-flex">
          Back to Periodic Table
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl">
      <div className="mb-3">
        <Link href="/app/periodic-table" className="btn btn-ghost text-xs py-1 px-2">
          ← Periodic Table
        </Link>
      </div>
      <ElementDetailPanel element={element} tempC={tempC} />
    </div>
  );
}
