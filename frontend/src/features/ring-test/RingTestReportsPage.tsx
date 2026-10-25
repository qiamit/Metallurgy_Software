import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { Eye, Trash2 } from "lucide-react";
import { RingTestShell } from "@/features/ring-test/RingTestNav";
import { deleteRingTest, listRingTests } from "@/features/ring-test/ringTestApi";
import type { RingTestRecord } from "@/features/ring-test/types";
import { useAuth } from "@/hooks/useAuth";

export default function RingTestReportsPage() {
  const { orgId } = useAuth();
  const [rows, setRows] = useState<RingTestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await listRingTests());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = rows.filter((r) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (r.sample_description || "").toLowerCase().includes(q) ||
      (r.batch_number || "").toLowerCase().includes(q) ||
      r.tester_name.toLowerCase().includes(q)
    );
  });

  async function onDelete(id: string) {
    if (!confirm("Delete this ring test report?")) return;
    try {
      await deleteRingTest(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <RingTestShell title="Reports">
      <div className="card space-y-4 p-4 sm:p-5">
        <input
          className="input max-w-md"
          type="search"
          placeholder="Search by Sample, Batch, or Operator…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {error && <p className="text-sm text-red-300">{error}</p>}
        {loading ? (
          <p className="text-sm text-[var(--rt-muted)]">Loading reports…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[var(--rt-muted)]">No ring tests saved yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--rt-border)] text-left">
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  <th className="py-2 pr-3 font-semibold">Sample</th>
                  <th className="py-2 pr-3 font-semibold">Diameter</th>
                  <th className="py-2 pr-3 font-semibold">Batch</th>
                  <th className="py-2 pr-3 font-semibold">Operator</th>
                  <th className="py-2 pr-3 font-semibold">Result</th>
                  <th className="py-2 pr-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const pass = r.results?.overall_pass;
                  return (
                    <tr key={r.id} className="border-b border-[var(--rt-border)]">
                      <td className="whitespace-nowrap py-2 pr-3">
                        {r.test_date} {r.test_time}
                      </td>
                      <td className="py-2 pr-3">{r.sample_description || "—"}</td>
                      <td className="py-2 pr-3">{r.sample_diameter_mm} mm</td>
                      <td className="py-2 pr-3">{r.batch_number || "—"}</td>
                      <td className="py-2 pr-3">{r.tester_name}</td>
                      <td className="py-2 pr-3">
                        <span className={pass ? "pill-pass" : "pill-fail"}>
                          {pass === true ? "PASS" : pass === false ? "FAIL" : "—"}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/app/ring-test/reports/${r.id}`}
                            className="btn-ghost px-2 py-1 text-xs"
                          >
                            <Eye size={14} /> View
                          </Link>
                          <button
                            type="button"
                            className="btn-danger px-2 py-1 text-xs"
                            onClick={() => void onDelete(r.id)}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RingTestShell>
  );
}
