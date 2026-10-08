from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from app import cache
from app import queries
from app.db import get_session
from app.schemas import DriveDetail, SeasonDrives, SeasonOut, TodayOut, SeasonStats
from app.models import SeasonStatus
router = APIRouter(tags=["public"])
IST = ZoneInfo("Asia/Kolkata")


async def _season_with_drives(session: AsyncSession, label: str | None) -> dict:
    season = await queries.get_season(session, label)
    if season is None:
        raise HTTPException(status_code=404, detail="Season not found")
    drives = await queries.list_drives(session, season.id)
    return {"season": season, "drives": drives}


@router.get("/seasons", response_model=list[SeasonOut])
async def list_seasons(session: AsyncSession = Depends(get_session)):
    return await queries.list_seasons(session)


@router.get("/seasons/current", response_model=SeasonDrives)
async def current_season(session: AsyncSession = Depends(get_session)):
    return await _season_with_drives(session, None)


@router.get("/seasons/{label}", response_model=SeasonDrives)
async def season_by_label(label: str, session: AsyncSession = Depends(get_session)):
    return await _season_with_drives(session, label)


@router.get("/drives/{drive_id}", response_model=DriveDetail)
async def drive_detail(drive_id: int, session: AsyncSession = Depends(get_session)):
    drive = await queries.get_drive(session, drive_id)
    if drive is None:
        raise HTTPException(status_code=404, detail="Drive not found")
    return drive


@router.get("/today", response_model=TodayOut)
async def today(session: AsyncSession = Depends(get_session)):
    day = datetime.now(IST).date()
    rows = await queries.rounds_on(session, day)
    return {"day": day, "rounds": [dict(r._mapping) for r in rows]}

@router.get("/seasons/{label}/stats", response_model=SeasonStats)
async def season_stats(
    label: str, response: Response, session: AsyncSession = Depends(get_session)
):
    key = cache.stats_key(label)
    cached = await cache.get_json(key)
    if cached is not None:
        response.headers["X-Cache"] = "HIT"
        return cached

    season = await queries.get_season(session, label)
    if season is None:
        raise HTTPException(status_code=404, detail="Season not found")
    stats = {"season": season.label, **await queries.season_stats(session, season.id)}
    ttl = (
        cache.ACTIVE_TTL_SECONDS
        if season.status == SeasonStatus.active
        else cache.ARCHIVED_TTL_SECONDS
    )
    await cache.set_json(key, stats, ttl)
    response.headers["X-Cache"] = "MISS"
    return stats