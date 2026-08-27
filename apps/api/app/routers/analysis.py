from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_role
from app.models.db import AnalysisJob, AnalysisType, JobStatus, Role, Sample
from app.schemas import DashboardOut, JobCreateIn, JobOut, ReviewIn, SampleIn, SampleOut
from app.services.pipeline import process_job
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
    if not job.software_result:
        job = await process_job(db, job, run_ai=True)
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
