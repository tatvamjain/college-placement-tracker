from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models import DriveStatus, JobType, RoundStatus, RoundType, SeasonStatus


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SeasonOut(ORMModel):
    label: str
    status: SeasonStatus


class CompanyOut(ORMModel):
    id: int
    name: str
    sector: str | None
    website: str | None


class RoleOut(ORMModel):
    title: str
    job_type: JobType
    ctc_inr: int | None
    stipend_inr: int | None
    location: str | None
    selected_count: int


class RoundOut(ORMModel):
    round_order: int
    round_type: RoundType
    scheduled_on: date | None
    status: RoundStatus
    shortlisted_count: int | None


class UpdateOut(ORMModel):
    message: str
    posted_at: datetime


class DriveSummary(ORMModel):
    id: int
    company: CompanyOut
    status: DriveStatus
    visit_date: date | None
    roles: list[RoleOut]


class DriveDetail(DriveSummary):
    season: SeasonOut
    results_published_at: datetime | None
    rounds: list[RoundOut]
    updates: list[UpdateOut]


class SeasonDrives(BaseModel):
    season: SeasonOut
    drives: list[DriveSummary]


class TodayRound(BaseModel):
    drive_id: int
    company: str
    round_order: int
    round_type: RoundType
    status: RoundStatus


class TodayOut(BaseModel):
    day: date
    rounds: list[TodayRound]