import argparse
import asyncio
import csv
import uuid
from collections import defaultdict
from datetime import date

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import admin, cache
from app.db import SessionLocal, engine
from app.models import Company, Drive, DriveStatus, JobType, Season
from app.schemas import CompanyIn, DriveIn, RoleIn


class CsvRow(BaseModel):
    company: str = Field(min_length=1)
    sector: str | None = None
    visit_date: date
    status: DriveStatus = DriveStatus.completed
    role_title: str = Field(min_length=1)
    job_type: JobType
    ctc_inr: int | None = Field(default=None, ge=0)
    stipend_inr: int | None = Field(default=None, ge=0)
    location: str | None = None
    selected_count: int = Field(default=0, ge=0)


def read_rows(path: str) -> list[CsvRow]:
    rows, errors = [], []
    with open(path, newline="", encoding="utf-8-sig") as f:
        for line_no, raw in enumerate(csv.DictReader(f), start=2):
            cleaned = {k: v.strip() for k, v in raw.items() if v and v.strip()}
            try:
                rows.append(CsvRow(**cleaned))
            except ValidationError as exc:
                for err in exc.errors():
                    errors.append(f"line {line_no}: {err['loc'][0]}: {err['msg']}")
    if errors:
        raise SystemExit("CSV has errors, nothing imported:\n" + "\n".join(errors))
    return rows


async def get_or_create_company(session: AsyncSession, actor: uuid.UUID, row: CsvRow) -> int:
    existing = await session.scalar(select(Company.id).where(Company.name == row.company))
    if existing is not None:
        return existing
    company = await admin.create_company(session, actor, CompanyIn(name=row.company, sector=row.sector))
    return company.id


async def run(label: str, path: str, actor: uuid.UUID) -> None:
    rows = read_rows(path)
    groups: dict[tuple[str, date], list[CsvRow]] = defaultdict(list)
    for row in rows:
        groups[(row.company.lower(), row.visit_date)].append(row)

    created = skipped = 0
    async with SessionLocal() as session:
        season = await session.scalar(select(Season).where(Season.label == label))
        if season is None:
            raise SystemExit(f"Season {label} not found")

        for group in groups.values():
            first = group[0]
            company_id = await get_or_create_company(session, actor, first)
            already = await session.scalar(
                select(Drive.id).where(
                    Drive.season_id == season.id,
                    Drive.company_id == company_id,
                    Drive.visit_date == first.visit_date,
                )
            )
            if already is not None:
                skipped += 1
                continue

            roles = [
                RoleIn(
                    title=r.role_title,
                    job_type=r.job_type,
                    ctc_inr=r.ctc_inr,
                    stipend_inr=r.stipend_inr,
                    location=r.location,
                    selected_count=r.selected_count,
                )
                for r in group
            ]
            await admin.create_drive(
                session,
                actor,
                DriveIn(
                    season_label=label,
                    company_id=company_id,
                    visit_date=first.visit_date,
                    status=first.status,
                    roles=roles,
                ),
            )
            created += 1

    await cache.redis.aclose()
    await engine.dispose()
    print(f"Drives created: {created}, skipped (already imported): {skipped}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import one season's drives from a CSV file")
    parser.add_argument("season", help="Season label, e.g. 2025-26")
    parser.add_argument("csv_path")
    parser.add_argument("--actor", required=True, type=uuid.UUID, help="Your admin user id")
    args = parser.parse_args()
    asyncio.run(run(args.season, args.csv_path, args.actor))


if __name__ == "__main__":
    main()