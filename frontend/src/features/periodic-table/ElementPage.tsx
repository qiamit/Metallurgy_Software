import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { ElementDetailPanel } from "@/features/periodic-table/ElementDetailPanel";
import { ELEMENT_BY_SYMBOL, STP_TEMP_C } from "@/features/periodic-table/elementsData";

export default function ElementDetailPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
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
        <Link to="/app/periodic-table" className="btn btn-primary mt-4 inline-flex">
          Back to Periodic Table
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl">
      <div className="mb-3">
        <Link to="/app/periodic-table" className="btn btn-ghost text-xs py-1 px-2">
          ← Periodic Table
        </Link>
      </div>
      <ElementDetailPanel element={element} tempC={tempC} />
    </div>
  );
}
