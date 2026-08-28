from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.core.database import get_db
from app.core.security import require_role
from app.models.db import AnalysisJob, AnalysisType, JobStatus, Organization, Role, Sample
from app.schemas import (
    AiSettingsIn,
    AiSettingsOut,
    DashboardOut,
    JobCreateIn,
    JobOut,
    LabSettingsIn,
    LabSettingsOut,
    ReviewIn,
    SampleIn,
    SampleOut,
)
from app.services.ai_settings import ai_settings_public, merge_org_ai_settings
from app.services.lab_settings import merge_lab_settings, read_lab_settings, set_lab_asset
from app.services.pipeline import process_job, rerun_ai_only
from app.services.reports import build_analysis_pdf
from app.services.storage import storage

router = APIRouter(prefix="/orgs/{organization_id}", tags=["analysis"])


@router.get("/dashboard", response_model=DashboardOut)
async def dashboard(
    organization_id: str,
    ctx=Depends(require_role(Role.viewer)),
    db: AsyncSession = Depends(get_db),
):
    samples = await db.scalar(
        select(func.count()).select_from(Sample).where(Sample.organization_id == organization_id)
    )
    jobs = await db.scalar(
        select(func.count()).select_from(AnalysisJob).where(AnalysisJob.organization_id == organization_id)
    )
    completed = await db.scalar(
        select(func.count())
        .select_from(AnalysisJob)
        .where(
            AnalysisJob.organization_id == organization_id,
            AnalysisJob.status.in_([JobStatus.completed, JobStatus.reviewed]),
        )
    )
    pending = await db.scalar(
        select(func.count())
        .select_from(AnalysisJob)
        .where(
            AnalysisJob.organization_id == organization_id,
            AnalysisJob.status.in_([JobStatus.pending, JobStatus.processing]),
        )
    )
    by_type_rows = await db.execute(
        select(AnalysisJob.analysis_type, func.count())
        .where(AnalysisJob.organization_id == organization_id)
        .group_by(AnalysisJob.analysis_type)
    )
    by_type = {row[0].value: row[1] for row in by_type_rows.all()}
    return DashboardOut(
        samples=samples or 0,
        jobs=jobs or 0,
        completed=completed or 0,
        pending=pending or 0,
        by_type=by_type,
    )


@router.get("/ai-settings", response_model=AiSettingsOut)
async def get_ai_settings(
    organization_id: str,
    ctx=Depends(require_role(Role.admin)),
    db: AsyncSession = Depends(get_db),
):
    org = await db.get(Organization, organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return AiSettingsOut(**ai_settings_public(org.branding))


@router.put("/ai-settings", response_model=AiSettingsOut)
async def update_ai_settings(
    organization_id: str,
    payload: AiSettingsIn,
    ctx=Depends(require_role(Role.admin)),
    db: AsyncSession = Depends(get_db),
):
    org = await db.get(Organization, organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if payload.provider.lower() not in {"deepseek", "openai"}:
        raise HTTPException(status_code=400, detail="Provider must be deepseek or openai")
    org.branding = merge_org_ai_settings(
        org.branding,
        provider=payload.provider,
        model=payload.model,
        api_key=payload.api_key,
        clear_key=payload.clear_key,
    )
    flag_modified(org, "branding")
    await db.commit()
    await db.refresh(org)
    return AiSettingsOut(**ai_settings_public(org.branding))


@router.get("/lab-settings", response_model=LabSettingsOut)
async def get_lab_settings(
    organization_id: str,
    ctx=Depends(require_role(Role.admin)),
    db: AsyncSession = Depends(get_db),
):
    org = await db.get(Organization, organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return LabSettingsOut(**read_lab_settings(org.branding, org.name))


@router.put("/lab-settings", response_model=LabSettingsOut)
async def update_lab_settings(
    organization_id: str,
    payload: LabSettingsIn,
    ctx=Depends(require_role(Role.admin)),
    db: AsyncSession = Depends(get_db),
):
    org = await db.get(Organization, organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    org.name = payload.company_name.strip() or org.name
    org.branding = merge_lab_settings(org.branding, payload.model_dump())
    flag_modified(org, "branding")
    await db.commit()
    await db.refresh(org)
    return LabSettingsOut(**read_lab_settings(org.branding, org.name))


@router.post("/lab-settings/assets/{asset_type}", response_model=LabSettingsOut)
async def upload_lab_asset(
    organization_id: str,
    asset_type: str,
    file: UploadFile = File(...),
    ctx=Depends(require_role(Role.admin)),
    db: AsyncSession = Depends(get_db),
):
    org = await db.get(Organization, organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if asset_type not in {"logo", "header", "footer", "watermark"}:
        raise HTTPException(status_code=400, detail="Invalid asset type")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    key = storage.save_bytes(data, file.filename or f"{asset_type}.png", folder="branding")
    try:
        org.branding = set_lab_asset(org.branding, asset_type, key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    flag_modified(org, "branding")
    await db.commit()
    await db.refresh(org)
    return LabSettingsOut(**read_lab_settings(org.branding, org.name))


@router.get("/samples", response_model=list[SampleOut])
async def list_samples(
    organization_id: str,
    ctx=Depends(require_role(Role.viewer)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Sample).where(Sample.organization_id == organization_id).order_by(Sample.created_at.desc())
    )
    return result.scalars().all()


@router.post("/samples", response_model=SampleOut)
async def create_sample(
    organization_id: str,
    payload: SampleIn,
    ctx=Depends(require_role(Role.analyst)),
    db: AsyncSession = Depends(get_db),
):
    user, _ = ctx
    sample = Sample(organization_id=organization_id, created_by=user.id, **payload.model_dump())
    db.add(sample)
    await db.commit()
    await db.refresh(sample)
    return sample


@router.get("/jobs", response_model=list[JobOut])
async def list_jobs(
    organization_id: str,
    ctx=Depends(require_role(Role.viewer)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AnalysisJob)
        .where(AnalysisJob.organization_id == organization_id)
        .order_by(AnalysisJob.created_at.desc())
        .limit(100)
    )
    return result.scalars().all()


@router.get("/jobs/{job_id}", response_model=JobOut)
async def get_job(
    organization_id: str,
    job_id: str,
    ctx=Depends(require_role(Role.viewer)),
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(AnalysisJob, job_id)
    if not job or job.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/jobs", response_model=JobOut)
async def create_job_with_upload(
    organization_id: str,
    sample_id: str = Form(...),
    analysis_type: AnalysisType = Form(...),
    calibration_id: str | None = Form(None),
    run_ai: bool = Form(True),
    file: UploadFile = File(...),
    ctx=Depends(require_role(Role.analyst)),
    db: AsyncSession = Depends(get_db),
):
    user, _ = ctx
    sample = await db.get(Sample, sample_id)
    if not sample or sample.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Sample not found")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    key = storage.save_bytes(data, file.filename or "capture.jpg", folder="uploads")

    job = AnalysisJob(
        organization_id=organization_id,
        sample_id=sample_id,
        calibration_id=calibration_id or None,
        analysis_type=analysis_type,
        status=JobStatus.pending,
        source_image_key=key,
        created_by=user.id,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    job = await process_job(db, job, run_ai=run_ai)
    return job


@router.post("/jobs/{job_id}/ai", response_model=JobOut)
async def rerun_ai(
    organization_id: str,
    job_id: str,
    ctx=Depends(require_role(Role.analyst)),
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(AnalysisJob, job_id)
    if not job or job.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.software_result and job.source_image_key:
        job = await rerun_ai_only(db, job)
    else:
        job = await process_job(db, job, run_ai=True)
    return job


@router.post("/jobs/{job_id}/review", response_model=JobOut)
async def review_job(
    organization_id: str,
    job_id: str,
    payload: ReviewIn,
    ctx=Depends(require_role(Role.reviewer)),
    db: AsyncSession = Depends(get_db),
):
    user, _ = ctx
    job = await db.get(AnalysisJob, job_id)
    if not job or job.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Job not found")
    job.status = JobStatus.reviewed if payload.approve else JobStatus.rejected
    job.reviewed_by = user.id
    job.review_notes = payload.notes
    await db.commit()
    await db.refresh(job)
    return job


@router.delete("/jobs/{job_id}")
async def delete_job(
    organization_id: str,
    job_id: str,
    ctx=Depends(require_role(Role.analyst)),
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(AnalysisJob, job_id)
    if not job or job.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Job not found")
    await db.delete(job)
    await db.commit()
    return {"ok": True}


@router.get("/jobs/{job_id}/report.pdf")
async def job_report_pdf(
    organization_id: str,
    job_id: str,
    ctx=Depends(require_role(Role.viewer)),
    db: AsyncSession = Depends(get_db),
):
    from app.models.db import Organization

    job = await db.get(AnalysisJob, job_id)
    if not job or job.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Job not found")
    org = await db.get(Organization, organization_id)
    sample = await db.get(Sample, job.sample_id)
    pdf = build_analysis_pdf(
        org_name=org.name if org else "Lab",
        sample_code=sample.sample_code if sample else job.sample_id,
        analysis_type=job.analysis_type.value,
        software_result=job.software_result,
        ai_result=job.ai_result,
        comparison=job.comparison,
    )
    return Response(content=pdf, media_type="application/pdf")
