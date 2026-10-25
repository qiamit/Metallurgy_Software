/**
 * Ring Test domain types — IS 1786:2008 TMT rib measurement.
 */

export interface ThicknessMeasurement {
  label: string;
  angle_deg: number;
  thickness_mm: number | null;
  inner_xy: [number, number] | null;
  outer_xy: [number, number] | null;
  rib_shift_deg?: number;
  rib_core?: boolean;
  uncertain?: boolean;
}

export interface AnalysisResults {
  sample_diameter_mm: number;
  mm_per_px: number;
  inner_circle: { cx: number; cy: number; r: number } | null;
  outer_circle: { cx: number; cy: number; r: number } | null;
  diameter_box: { x: number; y: number; w: number; h: number } | null;
  thickness_measurements: ThicknessMeasurement[];
  thickness_min_mm: number | null;
  thickness_max_mm: number | null;
  thickness_mean_mm: number | null;
  thickness_in_range: boolean | null;
  thickness_range_low_mm: number | null;
  thickness_range_high_mm: number | null;
  area_tm_mm2: number | null;
  area_fp_mm2: number | null;
  tm_area_fraction_percent: number | null;
  tm_area_share_in_range: boolean | null;
  overall_pass: boolean | null;
  observations?: string;
  nominal_diameter_mm?: number | null;
  measured_diameter_mm?: number | null;
  equivalent_diameter_mm?: number | null;
  concentricity_mm?: number | null;
  thickness_spread_mm?: number | null;
  rib_mode?: string;
  warnings?: string[];
}

export interface RingTestRecord {
  id: string;
  organization_id: string;
  sample_description: string | null;
  sample_diameter_mm: number;
  batch_number: string | null;
  mfg_date: string | null;
  tester_name: string;
  test_date: string;
  test_time: string;
  image_path: string | null;
  results: AnalysisResults;
  observations: string | null;
  created_by: string | null;
  created_at: string;
}

export interface RingTestSettings {
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
}
