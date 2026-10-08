import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Identity,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import CITEXT, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def pg_enum(enum_cls: type[enum.Enum], name: str) -> Enum:
    return Enum(enum_cls, name=name, values_callable=lambda e: [m.value for m in e])


class SeasonStatus(str, enum.Enum):
    active = "active"
    archived = "archived"


class DriveStatus(str, enum.Enum):
    announced = "announced"
    ongoing = "ongoing"
    completed = "completed"
    cancelled = "cancelled"


class JobType(str, enum.Enum):
    fte = "fte"
    intern = "intern"
    intern_ppo = "intern_ppo"


class RoundType(str, enum.Enum):
    ppt = "ppt"
    oa = "oa"
    gd = "gd"
    technical = "technical"
    hr = "hr"


class RoundStatus(str, enum.Enum):
    scheduled = "scheduled"
    ongoing = "ongoing"
    completed = "completed"


class Season(Base):
    __tablename__ = "seasons"
    __table_args__ = (
        Index(
            "uq_seasons_single_active",
            "status",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
    )

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    label: Mapped[str] = mapped_column(String(9), unique=True)
    status: Mapped[SeasonStatus] = mapped_column(pg_enum(SeasonStatus, "season_status"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    drives: Mapped[list["Drive"]] = relationship(back_populates="season")


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    name: Mapped[str] = mapped_column(CITEXT, unique=True)
    sector: Mapped[str | None] = mapped_column(String(100))
    website: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    drives: Mapped[list["Drive"]] = relationship(back_populates="company")


class Drive(Base):
    __tablename__ = "drives"

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id"), index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    status: Mapped[DriveStatus] = mapped_column(
        pg_enum(DriveStatus, "drive_status"),
        default=DriveStatus.announced,
        server_default=DriveStatus.announced.value,
    )
    visit_date: Mapped[date | None] = mapped_column(Date)
    results_published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[uuid.UUID]
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    season: Mapped[Season] = relationship(back_populates="drives")
    company: Mapped[Company] = relationship(back_populates="drives")
    roles: Mapped[list["DriveRole"]] = relationship(
        back_populates="drive", cascade="all, delete-orphan"
    )
    rounds: Mapped[list["DriveRound"]] = relationship(
        back_populates="drive", cascade="all, delete-orphan", order_by="DriveRound.round_order"
    )
    updates: Mapped[list["DriveUpdate"]] = relationship(
        back_populates="drive",
        cascade="all, delete-orphan",
        order_by="DriveUpdate.posted_at.desc()",
    )


class DriveRole(Base):
    __tablename__ = "drive_roles"
    __table_args__ = (
        CheckConstraint("ctc_inr >= 0", name="ctc_non_negative"),
        CheckConstraint("stipend_inr >= 0", name="stipend_non_negative"),
        CheckConstraint("selected_count >= 0", name="selected_non_negative"),
    )

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    drive_id: Mapped[int] = mapped_column(
        ForeignKey("drives.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(100))
    job_type: Mapped[JobType] = mapped_column(pg_enum(JobType, "job_type"))
    ctc_inr: Mapped[int | None] = mapped_column(BigInteger)
    stipend_inr: Mapped[int | None] = mapped_column(BigInteger)
    location: Mapped[str | None] = mapped_column(String(100))
    selected_count: Mapped[int] = mapped_column(default=0, server_default="0")

    drive: Mapped[Drive] = relationship(back_populates="roles")


class DriveRound(Base):
    __tablename__ = "drive_rounds"
    __table_args__ = (
        UniqueConstraint("drive_id", "round_order", name="uq_drive_rounds_drive_order"),
        CheckConstraint("round_order >= 1", name="order_positive"),
        CheckConstraint("shortlisted_count >= 0", name="shortlisted_non_negative"),
    )

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    drive_id: Mapped[int] = mapped_column(ForeignKey("drives.id", ondelete="CASCADE"))
    round_order: Mapped[int]
    round_type: Mapped[RoundType] = mapped_column(pg_enum(RoundType, "round_type"))
    scheduled_on: Mapped[date | None] = mapped_column(Date, index=True)
    status: Mapped[RoundStatus] = mapped_column(
        pg_enum(RoundStatus, "round_status"),
        default=RoundStatus.scheduled,
        server_default=RoundStatus.scheduled.value,
    )
    shortlisted_count: Mapped[int | None]

    drive: Mapped[Drive] = relationship(back_populates="rounds")


class DriveUpdate(Base):
    __tablename__ = "drive_updates"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    drive_id: Mapped[int] = mapped_column(
        ForeignKey("drives.id", ondelete="CASCADE"), index=True
    )
    message: Mapped[str] = mapped_column(Text)
    posted_by: Mapped[uuid.UUID]
    posted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    drive: Mapped[Drive] = relationship(back_populates="updates")


class AuditLog(Base):
    __tablename__ = "audit_log"
    __table_args__ = (Index("ix_audit_log_entity", "entity_type", "entity_id"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    actor_user_id: Mapped[uuid.UUID]
    action: Mapped[str] = mapped_column(String(50))
    entity_type: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[int] = mapped_column(BigInteger)
    changes: Mapped[dict] = mapped_column(JSONB)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PlacementOutbox(Base):
    __tablename__ = "placement_outbox"
    __table_args__ = (
        Index(
            "ix_placement_outbox_unpublished",
            "created_at",
            postgresql_where=text("published_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(100))
    payload: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))