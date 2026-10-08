from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, field_validator, Field

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

class CompanyIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    sector: str | None = Field(default=None, max_length=100)
    website: str | None = Field(default=None, max_length=255)


class RoleIn(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    job_type: JobType
    ctc_inr: int | None = Field(default=None, ge=0)
    stipend_inr: int | None = Field(default=None, ge=0)
    location: str | None = Field(default=None, max_length=100)


class RoundIn(BaseModel):
    round_type: RoundType
    scheduled_on: date | None = None


class DriveIn(BaseModel):
    season_label: str
    company_id: int
    visit_date: date | None = None
    roles: list[RoleIn] = Field(min_length=1)
    rounds: list[RoundIn] = []


class DrivePatch(BaseModel):
    status: DriveStatus | None = None
    visit_date: date | None = None

    @field_validator("status")
    @classmethod
    def status_not_null(cls, v: DriveStatus | None) -> DriveStatus:
        if v is None:
            raise ValueError("status cannot be null")
        return v


class UpdateIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)