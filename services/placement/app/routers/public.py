from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app import queries
from app.db import get_session
from app.schemas import DriveDetail, SeasonDrives, SeasonOut, TodayOut

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