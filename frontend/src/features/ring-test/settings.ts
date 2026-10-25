/**
 * Ring Test settings — stored per lab in `ring_test_settings` (was localStorage in the old app).
 */
import { supabase } from "@/lib/supabaseClient";

export type RingSettings = {
  mm_per_px_override: number | null;
  angular_correction_deg: number;
  thickness_outer_gap_px: number;
  thickness_inner_gap_px: number;
  inner_color: string;
  outer_color: string;
  diam_color: string;
  thick_color: string;
  inner_width: number;
  outer_width: number;
  diam_width: number;
  thick_width: number;
};


export const DEFAULT_RING_SETTINGS: RingSettings = {
  mm_per_px_override: null,
  angular_correction_deg: 0,
  thickness_outer_gap_px: 0,
  thickness_inner_gap_px: 0,
  inner_color: "#fde047",
  outer_color: "#f472b6",
  diam_color: "#fb923c",
  thick_color: "#4ade80",
  inner_width: 1,
  outer_width: 1,
  diam_width: 1,
  thick_width: 1,
};

export async function loadRingSettings(orgId: string): Promise<RingSettings> {
  const { data } = await supabase
    .from("ring_test_settings")
    .select("settings")
    .eq("organization_id", orgId)
    .maybeSingle();
  return { ...DEFAULT_RING_SETTINGS, ...((data?.settings as Partial<RingSettings> | undefined) ?? {}) };
}

export async function saveRingSettings(orgId: string, settings: RingSettings): Promise<void> {
  const { error } = await supabase
    .from("ring_test_settings")
    .update({ settings })
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
}
