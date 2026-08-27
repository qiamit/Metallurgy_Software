from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field

from app.models.db import AnalysisType, JobStatus, Role


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str
    organization_name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    full_name: str


class OrgOut(BaseModel):
    id: str
    name: str
    slug: str
    role: Role | None = None


class MembershipOut(BaseModel):
    id: str
    user_id: str
    email: str | None = None
    full_name: str | None = None
    role: Role


class InviteIn(BaseModel):
    email: EmailStr
    full_name: str
    password: str = Field(min_length=8)
    role: Role = Role.analyst


class CalibrationIn(BaseModel):
    name: str
    objective: str
    um_per_px_x: float
    um_per_px_y: float
    unit: str = "um"
    notes: str | None = None


class CalibrationOut(CalibrationIn):
    id: str
    organization_id: str
    created_at: datetime


class SampleIn(BaseModel):
    sample_code: str
    material: str | None = None
    description: str | None = None


class SampleOut(SampleIn):
    id: str
    organization_id: str
    created_at: datetime


class JobCreateIn(BaseModel):
    sample_id: str
    calibration_id: str | None = None
    analysis_type: AnalysisType
    run_ai: bool = True


class JobOut(BaseModel):
    id: str
    organization_id: str
    sample_id: str
    calibration_id: str | None
    analysis_type: AnalysisType
    status: JobStatus
    source_image_key: str | None
    overlay_image_key: str | None
    software_result: dict[str, Any] | None
    ai_result: dict[str, Any] | None
    comparison: dict[str, Any] | None
    error_message: str | None
    created_at: datetime
    completed_at: datetime | None


class ReviewIn(BaseModel):
    approve: bool
    notes: str | None = None


class DashboardOut(BaseModel):
    samples: int
    jobs: int
    completed: int
    pending: int
    by_type: dict[str, int]
