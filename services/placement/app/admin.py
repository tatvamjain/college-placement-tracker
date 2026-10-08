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
from app.schemas import CompanyIn, DriveIn, DrivePatch, UpdateIn, RolePatch


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
        visit_date=data.visit_date,
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
        data.model_dump(mode="json"), event_type="DriveCreated",
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
        changes[field] = {"from": getattr(role, field), "to": new}
        setattr(role, field, new)
    _record(session, actor_id, "update", "drive_role", role.id, changes, event_type="RoleUpdated")
    await session.commit()
    await cache.delete(cache.stats_key(season.label))
    return drive.id