import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import AuthOutbox, RefreshToken, User, UserRole


class UserNotFound(Exception):
    pass


class CannotTargetSelf(Exception):
    pass


def _event(event_type: str, data: dict, now: datetime) -> AuthOutbox:
    return AuthOutbox(
        event_type=event_type,
        payload={
            "event_id": str(uuid.uuid4()),
            "event_type": event_type,
            "version": 1,
            "occurred_at": now.isoformat(),
            "producer": "auth-service",
            "data": data,
        },
    )


async def _get_target(
    session: AsyncSession, actor_id: uuid.UUID, user_id: uuid.UUID
) -> User:
    if user_id == actor_id:
        raise CannotTargetSelf
    user = await session.scalar(
        select(User).options(selectinload(User.pseudonym)).where(User.id == user_id)
    )
    if user is None:
        raise UserNotFound
    return user


async def ban_user(
    session: AsyncSession, actor_id: uuid.UUID, user_id: uuid.UUID, days: int
) -> datetime:
    now = datetime.now(timezone.utc)
    user = await _get_target(session, actor_id, user_id)
    user.banned_until = now + timedelta(days=days)

    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
        .execution_options(synchronize_session=False)
    )
    session.add(
        _event(
            "UserBanned",
            {
                "pseudo_id": str(user.pseudonym.pseudo_id),
                "banned_until": user.banned_until.isoformat(),
            },
            now,
        )
    )
    await session.commit()
    return user.banned_until


async def unban_user(
    session: AsyncSession, actor_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    now = datetime.now(timezone.utc)
    user = await _get_target(session, actor_id, user_id)
    user.banned_until = None
    session.add(
        _event("UserUnbanned", {"pseudo_id": str(user.pseudonym.pseudo_id)}, now)
    )
    await session.commit()


async def set_role(
    session: AsyncSession, actor_id: uuid.UUID, user_id: uuid.UUID, role: UserRole
) -> None:
    now = datetime.now(timezone.utc)
    user = await _get_target(session, actor_id, user_id)
    user.role = role
    session.add(
        _event(
            "RoleChanged",
            {"pseudo_id": str(user.pseudonym.pseudo_id), "role": role.value},
            now,
        )
    )
    await session.commit()
