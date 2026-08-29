/**
 * Client-side Ring Test settings (localStorage) — mirrors original app defaults.
 */

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

const KEY = "ring-test:settings:v1";

export const DEFAULT_RING_SETTINGS: RingSettings = {
  mm_per_px_override: null,
  angular_correction_deg: 0,
  thickness_outer_gap_px: 1,
  thickness_inner_gap_px: 1,
  inner_color: "#fde047",
  outer_color: "#f472b6",
  diam_color: "#fb923c",
  thick_color: "#4ade80",
  inner_width: 1,
  outer_width: 1,
  diam_width: 1,
  thick_width: 1,
};

export function loadRingSettings(): RingSettings {
  if (typeof window === "undefined") return { ...DEFAULT_RING_SETTINGS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_RING_SETTINGS };
    return { ...DEFAULT_RING_SETTINGS, ...(JSON.parse(raw) as Partial<RingSettings>) };
  } catch {
    return { ...DEFAULT_RING_SETTINGS };
  }
}

export function saveRingSettings(settings: RingSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(settings));
}
