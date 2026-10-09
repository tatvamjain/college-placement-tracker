import uuid
from datetime import datetime, timezone
from app import cache
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AuditLog,
    Company,
    Drive,
    DriveRole,
    DriveRound,
    DriveUpdate,
    PlacementOutbox,
    Season,
)
from sqlalchemy import delete, func, select
from app.schemas import CompanyIn, DriveIn, DrivePatch, RoleIn, RolePatch, RoundIn, RoundPatch, UpdateIn
from app.models import SeasonStatus, DriveRound, DriveUpdate

class NotFound(Exception):
    pass


class Conflict(Exception):
    pass


def _record(
    session: AsyncSession,
    actor_id: uuid.UUID,
    action: str,
    entity_type: str,
    entity_id: int,
    changes: dict,
    event_type: str | None = None,
) -> None:
    session.add(
        AuditLog(
            actor_user_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            changes=changes,
        )
    )
    if event_type:
        session.add(
            PlacementOutbox(
                event_type=event_type,
                payload={
                    "event_id": str(uuid.uuid4()),
                    "event_type": event_type,
                    "version": 1,
                    "occurred_at": datetime.now(timezone.utc).isoformat(),
                    "producer": "placement-service",
                    "data": {f"{entity_type}_id": entity_id, "changes": changes},
                },
            )
        )


async def create_company(session: AsyncSession, actor_id: uuid.UUID, data: CompanyIn) -> Company:
    company = Company(**data.model_dump())
    session.add(company)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise Conflict("Company already exists")
    _record(session, actor_id, "create", "company", company.id, data.model_dump(mode="json"))
    await session.commit()
    return company


async def create_drive(session: AsyncSession, actor_id: uuid.UUID, data: DriveIn) -> int:
    season = await session.scalar(select(Season).where(Season.label == data.season_label))
    if season is None:
        raise NotFound("Season not found")
    if await session.get(Company, data.company_id) is None:
        raise NotFound("Company not found")

    drive = Drive(
        season_id=season.id,
        company_id=data.company_id,
        status=data.status,
        visit_date=data.visit_date,
        details=data.details,
        created_by=actor_id,
        roles=[DriveRole(**r.model_dump()) for r in data.roles],
        rounds=[
            DriveRound(round_order=i, **r.model_dump())
            for i, r in enumerate(data.rounds, start=1)
        ],
    )
    session.add(drive)
    await session.flush()
    _record(
        session, actor_id, "create", "drive", drive.id,
        data.model_dump(mode="json"), event_type="DriveCreated" if season.status == SeasonStatus.active else None,
    )
    await session.commit()
    await cache.delete(cache.stats_key(season.label))
    return drive.id


async def patch_drive(
    session: AsyncSession, actor_id: uuid.UUID, drive_id: int, data: DrivePatch
) -> None:
    drive = await session.get(Drive, drive_id)
    if drive is None:
        raise NotFound("Drive not found")
    updates = data.model_dump(exclude_unset=True)
    if not updates:
        return

    season = await session.get(Season, drive.season_id)
    changes = {}
    if "company_id" in updates and await session.get(Company, updates["company_id"]) is None:
        raise NotFound("Company not found")
    for field, new in updates.items():
        changes[field] = {"from": jsonable_encoder(getattr(drive, field)), "to": jsonable_encoder(new)}
        setattr(drive, field, new)
    _record(session, actor_id, "update", "drive", drive.id, changes, event_type="DriveUpdated")
    await session.commit()
    await cache.delete(cache.stats_key(season.label))


async def post_update(
    session: AsyncSession, actor_id: uuid.UUID, drive_id: int, data: UpdateIn
) -> DriveUpdate:
    if await session.get(Drive, drive_id) is None:
        raise NotFound("Drive not found")
    update = DriveUpdate(drive_id=drive_id, message=data.message, posted_by=actor_id)
    session.add(update)
    await session.flush()
    _record(
        session, actor_id, "create", "drive_update", update.id,
        {"drive_id": drive_id, "message": data.message}, event_type="DriveUpdatePosted",
    )
    await session.commit()
    await session.refresh(update)
    return update

async def patch_role(
    session: AsyncSession, actor_id: uuid.UUID, role_id: int, data: RolePatch
) -> int:
    role = await session.get(DriveRole, role_id)
    if role is None:
        raise NotFound("Role not found")
    drive = await session.get(Drive, role.drive_id)
    updates = data.model_dump(exclude_unset=True)
    if not updates:
        return drive.id

    season = await session.get(Season, drive.season_id)
    changes = {}
    for field, new in updates.items():
        changes[field] = {"from": jsonable_encoder(getattr(role, field)), "to": jsonable_encoder(new)}
        setattr(role, field, new)
    if role.base_inr is not None and role.ctc_inr is not None and role.base_inr > role.ctc_inr:
        raise Conflict("Base salary can't be more than the CTC")
    _record(session, actor_id, "update", "drive_role", role.id, changes, event_type="RoleUpdated")
    await session.commit()
    await cache.delete(cache.stats_key(season.label))
    return drive.id

async def patch_round(
    session: AsyncSession, actor_id: uuid.UUID, drive_id: int, round_order: int, data: RoundPatch
) -> None:
    rnd = await session.scalar(
        select(DriveRound).where(DriveRound.drive_id == drive_id, DriveRound.round_order == round_order)
    )
    if rnd is None:
        raise NotFound("Round not found")
    updates = data.model_dump(exclude_unset=True)
    if not updates:
        return
    changes = {}
    for field, new in updates.items():
        changes[field] = {"from": jsonable_encoder(getattr(rnd, field)), "to": jsonable_encoder(new)}
        setattr(rnd, field, new)
    _record(session, actor_id, "update", "round", rnd.id, changes)
    await session.commit()
    
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

async def delete_drive(session: AsyncSession, actor_id: uuid.UUID, drive_id: int) -> None:
    drive = await session.scalar(
        select(Drive)
        .options(selectinload(Drive.company), selectinload(Drive.season))
        .where(Drive.id == drive_id)
    )
    if drive is None:
        raise NotFound("Drive not found")
    snapshot = {
        "company": drive.company.name,
        "season": drive.season.label,
        "status": jsonable_encoder(drive.status),
        "visit_date": jsonable_encoder(drive.visit_date),
    }
    session.expunge(drive)
    await session.execute(delete(Drive).where(Drive.id == drive_id))
    _record(session, actor_id, "delete", "drive", drive_id, snapshot)
    await session.commit()
    await cache.delete(cache.stats_key(snapshot["season"]))

async def _lock_drive(session: AsyncSession, drive_id: int) -> Drive:
    drive = await session.scalar(select(Drive).where(Drive.id == drive_id).with_for_update())
    if drive is None:
        raise NotFound("Drive not found")
    return drive


async def add_round(session: AsyncSession, actor_id: uuid.UUID, drive_id: int, data: RoundIn) -> None:
    await _lock_drive(session, drive_id)
    last = await session.scalar(select(func.max(DriveRound.round_order)).where(DriveRound.drive_id == drive_id))
    rnd = DriveRound(
        drive_id=drive_id,
        round_order=(last or 0) + 1,
        round_type=data.round_type,
        scheduled_on=data.scheduled_on,
    )
    session.add(rnd)
    await session.flush()
    _record(session, actor_id, "create", "round", rnd.id, jsonable_encoder(data))
    await session.commit()


async def delete_round(session: AsyncSession, actor_id: uuid.UUID, drive_id: int, round_order: int) -> None:
    await _lock_drive(session, drive_id)
    rnd = await session.scalar(
        select(DriveRound).where(DriveRound.drive_id == drive_id, DriveRound.round_order == round_order)
    )
    if rnd is None:
        raise NotFound("Round not found")
    snapshot = {
        "round_order": rnd.round_order,
        "round_type": jsonable_encoder(rnd.round_type),
        "scheduled_on": jsonable_encoder(rnd.scheduled_on),
    }
    round_id = rnd.id
    await session.execute(delete(DriveRound).where(DriveRound.id == round_id))

    later = await session.scalars(
        select(DriveRound)
        .where(DriveRound.drive_id == drive_id, DriveRound.round_order > round_order)
        .order_by(DriveRound.round_order)
    )
    for r in later.all():
        r.round_order -= 1
        await session.flush()  # one row at a time, lowest first: never two rounds with the same number

    _record(session, actor_id, "delete", "round", round_id, snapshot)
    await session.commit()


async def add_role(session: AsyncSession, actor_id: uuid.UUID, drive_id: int, data: RoleIn) -> None:
    drive = await session.get(Drive, drive_id)
    if drive is None:
        raise NotFound("Drive not found")
    season = await session.get(Season, drive.season_id)
    role = DriveRole(drive_id=drive_id, **data.model_dump())
    session.add(role)
    await session.flush()
    _record(session, actor_id, "create", "drive_role", role.id, jsonable_encoder(data))
    await session.commit()
    await cache.delete(cache.stats_key(season.label))


async def delete_role(session: AsyncSession, actor_id: uuid.UUID, role_id: int) -> int:
    role = await session.get(DriveRole, role_id)
    if role is None:
        raise NotFound("Role not found")
    drive = await _lock_drive(session, role.drive_id)
    count = await session.scalar(select(func.count()).select_from(DriveRole).where(DriveRole.drive_id == drive.id))
    if count <= 1:
        raise Conflict("A drive needs at least one role. Delete the drive instead.")
    season = await session.get(Season, drive.season_id)
    snapshot = {
        "title": role.title,
        "job_type": jsonable_encoder(role.job_type),
        "ctc_inr": role.ctc_inr,
        "selected_count": role.selected_count,
    }
    await session.execute(delete(DriveRole).where(DriveRole.id == role_id))
    _record(session, actor_id, "delete", "drive_role", role_id, snapshot)
    await session.commit()
    await cache.delete(cache.stats_key(season.label))
    return drive.id