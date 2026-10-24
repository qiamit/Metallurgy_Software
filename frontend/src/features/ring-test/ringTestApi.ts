import { supabase } from "@/lib/supabaseClient";
import { dataUrlToBlob, removeLabFiles, uploadLabFile } from "@/lib/storage";
import type { AnalysisResults, RingTestRecord } from "@/features/ring-test/types";

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

const COLUMNS =
  "id, organization_id, sample_description, sample_diameter_mm, batch_number, mfg_date, tester_name, " +
  "test_date, test_time, image_path, results, observations, created_by, created_at";

/** The lab selected in the workspace switcher (saved by useAuth). */
function getOrgId(): string | null {
  try {
    return localStorage.getItem("ms_org_id");
  } catch {
    return null;
  }
}

const blankToNull = (v: string) => (v.trim() ? v.trim() : null);

export async function saveTest(
  payload: SaveTestPayload,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const orgId = getOrgId();
  if (!orgId) return { ok: false, error: "No organization selected." };

  let imagePath: string | null = null;
  try {
    const { data: auth } = await supabase.auth.getUser();
    imagePath = await uploadLabFile("ring-test-images", orgId, dataUrlToBlob(payload.imageDataUrl), "ring-");
    const { data, error } = await supabase
      .from("ring_tests")
      .insert({
        organization_id: orgId,
        sample_description: blankToNull(payload.sample_description),
        sample_diameter_mm: payload.sample_diameter_mm,
        batch_number: blankToNull(payload.batch_number),
        mfg_date: blankToNull(payload.mfg_date),
        tester_name: payload.tester_name.trim(),
        test_date: payload.test_date,
        test_time: payload.test_time,
        observations: blankToNull(payload.observations),
        results: payload.results,
        image_path: imagePath,
        created_by: auth.user?.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: data.id };
  } catch (err) {
    if (imagePath) await removeLabFiles("ring-test-images", [imagePath]);
    return { ok: false, error: err instanceof Error ? err.message : "Save failed" };
  }
}

export async function listRingTests(): Promise<RingTestRecord[]> {
  const orgId = getOrgId();
  if (!orgId) return [];
  const { data, error } = await supabase
    .from("ring_tests")
    .select(COLUMNS)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RingTestRecord[];
}

export async function getRingTest(id: string): Promise<RingTestRecord> {
  const { data, error } = await supabase.from("ring_tests").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Ring test not found.");
  return data as unknown as RingTestRecord;
}

export async function updateRingTest(
  id: string,
  fields: Partial<Pick<RingTestRecord, "sample_description" | "batch_number" | "mfg_date" | "tester_name" | "observations">>,
): Promise<void> {
  const { error } = await supabase.from("ring_tests").update(fields).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteRingTest(id: string): Promise<void> {
  const { data } = await supabase.from("ring_tests").select("image_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("ring_tests").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await removeLabFiles("ring-test-images", [data?.image_path]);
}
