from datetime import date

from sqlalchemy import Row, select, text
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

SEASON_STATS_SQL = text("""
WITH season_roles AS (
    SELECT r.job_type, r.ctc_inr, r.selected_count, d.company_id
    FROM drive_roles r
    JOIN drives d ON d.id = r.drive_id
    WHERE d.season_id = :season_id AND d.status <> 'cancelled'
),
fte_offers AS (
    SELECT sr.ctc_inr
    FROM season_roles sr
    CROSS JOIN LATERAL generate_series(1, sr.selected_count)
    WHERE sr.job_type IN ('fte', 'intern_fte') AND sr.ctc_inr IS NOT NULL
)
SELECT
    (SELECT count(DISTINCT company_id) FROM season_roles) AS companies,
    (SELECT coalesce(sum(selected_count), 0) FROM season_roles WHERE job_type IN ('fte', 'intern_fte')) AS fte_offers,
    (SELECT coalesce(sum(selected_count), 0) FROM season_roles WHERE job_type NOT IN ('fte', 'intern_fte')) AS intern_offers,
    (SELECT max(ctc_inr) FROM fte_offers) AS highest_ctc_inr,
    (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY ctc_inr) FROM fte_offers)::bigint AS median_ctc_inr,
    (SELECT round(avg(ctc_inr)) FROM fte_offers)::bigint AS average_ctc_inr
""")


async def season_stats(session: AsyncSession, season_id: int) -> dict:
    row = (await session.execute(SEASON_STATS_SQL, {"season_id": season_id})).one()
    return dict(row._mapping)