from __future__ import annotations

import base64
import re
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_role
from app.models.db import RingTest, Role
from app.services.storage import storage

router = APIRouter(prefix="/orgs/{organization_id}/ring-tests", tags=["ring-tests"])


class RingTestCreateIn(BaseModel):
    sample_description: str = ""
    sample_diameter_mm: float
    batch_number: str = ""
    mfg_date: str = ""
    tester_name: str
    test_date: str
    test_time: str
    observations: str = ""
    results: dict[str, Any]
    imageDataUrl: str = Field(alias="imageDataUrl")

    model_config = {"populate_by_name": True}


class RingTestOut(BaseModel):
    id: str
    organization_id: str
    sample_description: str | None
    sample_diameter_mm: float
    batch_number: str | None
    mfg_date: str | None
    tester_name: str
    test_date: str
    test_time: str
    image_key: str | None
    results: dict[str, Any] | None
    observations: str | None
    created_by: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


def _decode_data_url(data_url: str) -> tuple[bytes, str]:
    match = re.match(r"^data:(image/[^;]+);base64,(.+)$", data_url, re.DOTALL)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid image data.")
    content_type = match.group(1)
    try:
        raw = base64.b64decode(match.group(2))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid image encoding.") from exc
    ext = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/webp": ".webp",
    }.get(content_type, ".png")
    return raw, ext


@router.get("", response_model=list[RingTestOut])
async def list_ring_tests(
    organization_id: str,
    ctx=Depends(require_role(Role.viewer)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RingTest)
        .where(RingTest.organization_id == organization_id)
        .order_by(RingTest.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=RingTestOut)
async def create_ring_test(
    organization_id: str,
    payload: RingTestCreateIn,
    ctx=Depends(require_role(Role.analyst)),
    db: AsyncSession = Depends(get_db),
):
    user, _ = ctx
    image_key: str | None = None
    if payload.imageDataUrl:
        data, ext = _decode_data_url(payload.imageDataUrl)
        image_key = storage.save_bytes(data, f"ring{ext}", folder="ring-tests")

    record = RingTest(
        organization_id=organization_id,
        sample_description=payload.sample_description or None,
        sample_diameter_mm=payload.sample_diameter_mm,
        batch_number=payload.batch_number or None,
        mfg_date=payload.mfg_date or None,
        tester_name=payload.tester_name,
        test_date=payload.test_date,
        test_time=payload.test_time,
        image_key=image_key,
        results=payload.results,
        observations=payload.observations or None,
        created_by=user.id,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.get("/{test_id}", response_model=RingTestOut)
async def get_ring_test(
    organization_id: str,
    test_id: str,
    ctx=Depends(require_role(Role.viewer)),
    db: AsyncSession = Depends(get_db),
):
    record = await db.get(RingTest, test_id)
    if not record or record.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Ring test not found")
    return record


@router.delete("/{test_id}")
async def delete_ring_test(
    organization_id: str,
    test_id: str,
    ctx=Depends(require_role(Role.analyst)),
    db: AsyncSession = Depends(get_db),
):
    record = await db.get(RingTest, test_id)
    if not record or record.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Ring test not found")
    await db.delete(record)
    await db.commit()
    return {"ok": True}
