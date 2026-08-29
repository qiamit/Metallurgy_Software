import { api, getOrgId } from "@/lib/api";
import type { AnalysisResults, RingTestRecord } from "@/lib/ring-test/types";

export interface SaveTestPayload {
  sample_description: string;
  sample_diameter_mm: number;
  batch_number: string;
  mfg_date: string;
  tester_name: string;
  test_date: string;
  test_time: string;
  observations: string;
  results: AnalysisResults;
  imageDataUrl: string;
}

export async function saveTest(
  payload: SaveTestPayload,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const orgId = getOrgId();
  if (!orgId) return { ok: false, error: "No organization selected." };

  try {
    const record = await api<RingTestRecord>(`/api/orgs/${orgId}/ring-tests`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return { ok: true, id: record.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Save failed",
    };
  }
}

export async function listRingTests(): Promise<RingTestRecord[]> {
  const orgId = getOrgId();
  if (!orgId) return [];
  return api<RingTestRecord[]>(`/api/orgs/${orgId}/ring-tests`);
}

export async function getRingTest(id: string): Promise<RingTestRecord> {
  const orgId = getOrgId();
  if (!orgId) throw new Error("No organization selected.");
  return api<RingTestRecord>(`/api/orgs/${orgId}/ring-tests/${id}`);
}

export async function deleteRingTest(id: string): Promise<void> {
  const orgId = getOrgId();
  if (!orgId) throw new Error("No organization selected.");
  await api(`/api/orgs/${orgId}/ring-tests/${id}`, { method: "DELETE" });
}
