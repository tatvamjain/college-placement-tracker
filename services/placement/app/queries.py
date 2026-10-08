from datetime import date

from sqlalchemy import Row, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Company, Drive, DriveRound, DriveStatus, Season, SeasonStatus


async def list_seasons(session: AsyncSession) -> list[Season]:
    result = await session.scalars(select(Season).order_by(Season.label.desc()))
    return list(result)


async def get_season(session: AsyncSession, label: str | None) -> Season | None:
    stmt = select(Season)
    if label is None:
        stmt = stmt.where(Season.status == SeasonStatus.active)
    else:
        stmt = stmt.where(Season.label == label)
    return await session.scalar(stmt)


async def list_drives(session: AsyncSession, season_id: int) -> list[Drive]:
    stmt = (
        select(Drive)
        .where(Drive.season_id == season_id)
        .options(selectinload(Drive.company), selectinload(Drive.roles))
        .order_by(Drive.visit_date.desc().nulls_last(), Drive.id)
    )
    return list(await session.scalars(stmt))


async def get_drive(session: AsyncSession, drive_id: int) -> Drive | None:
    stmt = (
        select(Drive)
        .where(Drive.id == drive_id)
        .options(
            selectinload(Drive.company),
            selectinload(Drive.season),
            selectinload(Drive.roles),
            selectinload(Drive.rounds),
            selectinload(Drive.updates),
        )
    )
    return await session.scalar(stmt)


async def rounds_on(session: AsyncSession, day: date) -> list[Row]:
    stmt = (
        select(
            DriveRound.drive_id,
            Company.name.label("company"),
            DriveRound.round_order,
            DriveRound.round_type,
            DriveRound.status,
        )
        .join(DriveRound.drive)
        .join(Drive.company)
        .where(DriveRound.scheduled_on == day, Drive.status != DriveStatus.cancelled)
        .order_by(Company.name, DriveRound.round_order)
    )
    return list(await session.execute(stmt))