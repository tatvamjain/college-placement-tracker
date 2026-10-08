from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app import admin as admin_service
from app import queries
from app.db import get_session
from app.schemas import CompanyIn, CompanyOut, DriveDetail, DriveIn, DrivePatch, UpdateIn, UpdateOut, RolePatch, RoundPatch
from app.security import Admin, require_admin
from sqlalchemy import select
from app.models import Company, Drive, DriveRole

router = APIRouter(prefix="/admin", tags=["admin"])


async def _fresh_drive(session: AsyncSession, drive_id: int):
    session.expunge_all()
    return await queries.get_drive(session, drive_id)


@router.post("/companies", response_model=CompanyOut, status_code=201)
async def create_company(
    body: CompanyIn,
    admin: Admin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    return await admin_service.create_company(session, admin.user_id, body)


@router.post("/drives", response_model=DriveDetail, status_code=201)
async def create_drive(
    body: DriveIn,
    admin: Admin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    drive_id = await admin_service.create_drive(session, admin.user_id, body)
    return await _fresh_drive(session, drive_id)


@router.patch("/drives/{drive_id}", response_model=DriveDetail)
async def patch_drive(
    drive_id: int,
    body: DrivePatch,
    admin: Admin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    await admin_service.patch_drive(session, admin.user_id, drive_id, body)
    return await _fresh_drive(session, drive_id)


@router.post("/drives/{drive_id}/updates", response_model=UpdateOut, status_code=201)
async def post_update(
    drive_id: int,
    body: UpdateIn,
    admin: Admin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    return await admin_service.post_update(session, admin.user_id, drive_id, body)

@router.patch("/roles/{role_id}", response_model=DriveDetail)
async def patch_role(
    role_id: int,
    body: RolePatch,
    admin: Admin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    drive_id = await admin_service.patch_role(session, admin.user_id, role_id, body)
    return await _fresh_drive(session, drive_id)

@router.get("/companies", response_model=list[CompanyOut])
async def list_companies(
    admin: Admin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    return (await session.scalars(select(Company).order_by(Company.name))).all()


@router.patch("/drives/{drive_id}/rounds/{round_order}", response_model=DriveDetail)
async def patch_round(
    drive_id: int,
    round_order: int,
    body: RoundPatch,
    admin: Admin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    await admin_service.patch_round(session, admin.user_id, drive_id, round_order, body)
    return await _fresh_drive(session, drive_id)

@router.delete("/drives/{drive_id}", status_code=204)
async def delete_drive(
    drive_id: int,
    admin: Admin = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> None:
    await admin_service.delete_drive(session, admin.user_id, drive_id)