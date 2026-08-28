from __future__ import annotations

from datetime import datetime, timezone

import cv2
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import AnalysisJob, AnalysisType, Calibration, JobStatus, Organization
from app.services.ai_compare import compare_results, run_ai_analysis
from app.services.grain_size import analyze_grain_size
from app.services.phase2_analysis import (
    analyze_decarb,
    analyze_inclusion,
    analyze_macro,
    analyze_micro,
)
from app.services.storage import storage


ANALYZERS = {
    AnalysisType.grain_size: analyze_grain_size,
    AnalysisType.inclusion: analyze_inclusion,
    AnalysisType.decarb: analyze_decarb,
    AnalysisType.micro: analyze_micro,
    AnalysisType.macro: analyze_macro,
}


async def process_job(
    db: AsyncSession,
    job: AnalysisJob,
    *,
    run_ai: bool = True,
) -> AnalysisJob:
    job.status = JobStatus.processing
    await db.commit()

    try:
        if not job.source_image_key:
            raise ValueError("Missing source image")
        raw = storage.read_bytes(job.source_image_key)
        arr = np.frombuffer(raw, dtype=np.uint8)
        image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Unable to decode image")

        um_x = um_y = 1.0
        if job.calibration_id:
            cal = await db.get(Calibration, job.calibration_id)
            if cal:
                um_x, um_y = cal.um_per_px_x, cal.um_per_px_y

        analyzer = ANALYZERS[job.analysis_type]
        software_result, overlay = analyzer(image, um_x, um_y)
        ok, enc = cv2.imencode(".png", overlay)
        if not ok:
            raise ValueError("Failed to encode overlay")
        overlay_key = storage.save_bytes(enc.tobytes(), "overlay.png", folder="overlays")

        ai_result = None
        comparison = None
        if run_ai:
            org = await db.get(Organization, job.organization_id)
            ai_result = await run_ai_analysis(
                job.analysis_type,
                image,
                org_branding=org.branding if org else None,
                software_context=software_result,
            )
            comparison = compare_results(job.analysis_type, software_result, ai_result)

        job.software_result = software_result
        job.ai_result = ai_result
        job.comparison = comparison
        job.overlay_image_key = overlay_key
        job.status = JobStatus.completed
        job.completed_at = datetime.now(timezone.utc)
        job.error_message = None
    except Exception as exc:  # noqa: BLE001
        job.status = JobStatus.failed
        job.error_message = str(exc)

    await db.commit()
    await db.refresh(job)
    return job


async def rerun_ai_only(db: AsyncSession, job: AnalysisJob) -> AnalysisJob:
    """Re-run AI advisory using existing software results and source image."""
    job.status = JobStatus.processing
    job.error_message = None
    await db.commit()

    try:
        if not job.source_image_key:
            raise ValueError("Missing source image")
        if not job.software_result:
            return await process_job(db, job, run_ai=True)

        raw = storage.read_bytes(job.source_image_key)
        arr = np.frombuffer(raw, dtype=np.uint8)
        image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Unable to decode image")

        org = await db.get(Organization, job.organization_id)
        ai_result = await run_ai_analysis(
            job.analysis_type,
            image,
            org_branding=org.branding if org else None,
            software_context=job.software_result,
        )
        comparison = compare_results(job.analysis_type, job.software_result, ai_result)

        job.ai_result = ai_result
        job.comparison = comparison
        job.status = JobStatus.completed
        job.completed_at = datetime.now(timezone.utc)
        job.error_message = None
    except Exception as exc:  # noqa: BLE001
        if job.software_result:
            job.status = JobStatus.completed
        else:
            job.status = JobStatus.failed
        job.error_message = str(exc)

    await db.commit()
    await db.refresh(job)
    return job
