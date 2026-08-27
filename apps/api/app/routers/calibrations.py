from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_role
from app.models.db import Calibration, Role
from app.schemas import CalibrationIn, CalibrationOut

router = APIRouter(prefix="/orgs/{organization_id}/calibrations", tags=["calibrations"])


@router.get("", response_model=list[CalibrationOut])
async def list_calibrations(
    organization_id: str,
    ctx=Depends(require_role(Role.viewer)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Calibration).where(Calibration.organization_id == organization_id).order_by(Calibration.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=CalibrationOut)
async def create_calibration(
    organization_id: str,
    payload: CalibrationIn,
    ctx=Depends(require_role(Role.analyst)),
    db: AsyncSession = Depends(get_db),
):
    user, _ = ctx
    cal = Calibration(
        organization_id=organization_id,
        created_by=user.id,
        **payload.model_dump(),
    )
    db.add(cal)
    await db.commit()
    await db.refresh(cal)
    return cal


@router.delete("/{calibration_id}")
async def delete_calibration(
    organization_id: str,
    calibration_id: str,
    ctx=Depends(require_role(Role.admin)),
    db: AsyncSession = Depends(get_db),
):
    cal = await db.get(Calibration, calibration_id)
    if not cal or cal.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Calibration not found")
    await db.delete(cal)
    await db.commit()
    return {"ok": True}
