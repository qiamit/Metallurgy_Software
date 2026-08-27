export type Role = "owner" | "admin" | "analyst" | "reviewer" | "viewer";

export type AnalysisType =
  | "grain_size"
  | "micro"
  | "macro"
  | "inclusion"
  | "decarb";

export type JobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "reviewed"
  | "rejected";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  role?: Role;
}

export interface Calibration {
  id: string;
  organization_id: string;
  name: string;
  objective: string;
  um_per_px_x: number;
  um_per_px_y: number;
  unit: string;
  notes?: string | null;
}

export interface Sample {
  id: string;
  organization_id: string;
  sample_code: string;
  material?: string | null;
  description?: string | null;
}

export interface AnalysisJob {
  id: string;
  organization_id: string;
  sample_id: string;
  calibration_id?: string | null;
  analysis_type: AnalysisType;
  status: JobStatus;
  source_image_key?: string | null;
  overlay_image_key?: string | null;
  software_result?: Record<string, unknown> | null;
  ai_result?: Record<string, unknown> | null;
  comparison?: Record<string, unknown> | null;
  error_message?: string | null;
  created_at: string;
  completed_at?: string | null;
}

export const ANALYSIS_LABELS: Record<AnalysisType, string> = {
  grain_size: "Grain Size (ISO 643)",
  micro: "Micro Analysis",
  macro: "Macro Analysis (IS 10138)",
  inclusion: "Inclusion Rating (ISO 4967)",
  decarb: "Decarburization (ISO 3887)",
};
