import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    require_role,
    verify_password,
)
from app.models.db import Membership, Organization, Role, User
from app.schemas import (
    InviteIn,
    LoginIn,
    MembershipOut,
    OrgOut,
    RegisterIn,
    TokenOut,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def slugify(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", name.strip().lower()).strip("-")
    return s or "org"


@router.post("/register", response_model=TokenOut)
async def register(payload: RegisterIn, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == payload.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    base_slug = slugify(payload.organization_name)
    slug = base_slug
    i = 1
    while True:
        found = await db.execute(select(Organization).where(Organization.slug == slug))
        if not found.scalar_one_or_none():
            break
        i += 1
        slug = f"{base_slug}-{i}"

    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
    )
    org = Organization(name=payload.organization_name, slug=slug, branding={"accent": "#2f6f6a"})
    db.add(user)
    db.add(org)
    await db.flush()
    db.add(Membership(user_id=user.id, organization_id=org.id, role=Role.owner))
    await db.commit()
    token = create_access_token(user.id)
    return TokenOut(access_token=token)


@router.post("/login", response_model=TokenOut)
async def login(payload: LoginIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email.lower()))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return TokenOut(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return UserOut(id=user.id, email=user.email, full_name=user.full_name)


@router.get("/organizations", response_model=list[OrgOut])
async def list_orgs(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Membership)
        .options(selectinload(Membership.organization))
        .where(Membership.user_id == user.id)
    )
    memberships = result.scalars().all()
    return [
        OrgOut(
            id=m.organization.id,
            name=m.organization.name,
            slug=m.organization.slug,
            role=m.role,
        )
        for m in memberships
    ]


@router.get("/organizations/{organization_id}/members", response_model=list[MembershipOut])
async def list_members(
    organization_id: str,
    ctx=Depends(require_role(Role.admin)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Membership)
        .options(selectinload(Membership.user))
        .where(Membership.organization_id == organization_id)
    )
    rows = result.scalars().all()
    return [
        MembershipOut(
            id=m.id,
            user_id=m.user_id,
            email=m.user.email if m.user else None,
            full_name=m.user.full_name if m.user else None,
            role=m.role,
        )
        for m in rows
    ]


@router.post("/organizations/{organization_id}/members", response_model=MembershipOut)
async def invite_member(
    organization_id: str,
    payload: InviteIn,
    ctx=Depends(require_role(Role.admin)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == payload.email.lower()))
    user = result.scalar_one_or_none()
    if not user:
        user = User(
            email=payload.email.lower(),
            full_name=payload.full_name,
            hashed_password=hash_password(payload.password),
        )
        db.add(user)
        await db.flush()

    existing = await db.execute(
        select(Membership).where(
            Membership.user_id == user.id,
            Membership.organization_id == organization_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already a member")

    membership = Membership(user_id=user.id, organization_id=organization_id, role=payload.role)
    db.add(membership)
    await db.commit()
    await db.refresh(membership)
    return MembershipOut(
        id=membership.id,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=membership.role,
    )
