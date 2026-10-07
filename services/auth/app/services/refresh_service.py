import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models import RefreshToken, User
from app.services.users import is_banned
from app.tokens import create_access_token, hash_refresh_token, new_refresh_token


class InvalidRefreshToken(Exception):
    pass


class UserBanned(Exception):
    pass


async def _revoke_all(session: AsyncSession, user_id: uuid.UUID, now: datetime) -> None:
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
        .execution_options(synchronize_session=False)
    )


async def rotate(session: AsyncSession, raw: str) -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    token_hash = hash_refresh_token(raw)

    user_id = await session.scalar(
        update(RefreshToken)
        .where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
        .values(revoked_at=now)
        .returning(RefreshToken.user_id)
        .execution_options(synchronize_session=False)
    )

    if user_id is None:
        reused_by = await session.scalar(
            select(RefreshToken.user_id).where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked_at.is_not(None),
            )
        )
        if reused_by is not None:
            await _revoke_all(session, reused_by, now)
            await session.commit()
        raise InvalidRefreshToken

    user = await session.scalar(
        select(User).options(selectinload(User.pseudonym)).where(User.id == user_id)
    )
    if is_banned(user):
        await _revoke_all(session, user.id, now)
        await session.commit()
        raise UserBanned

    new_raw, new_hash = new_refresh_token()
    session.add(
        RefreshToken(
            user_id=user.id,
            token_hash=new_hash,
            expires_at=now + timedelta(days=settings.refresh_token_ttl_days),
        )
    )
    await session.commit()
    return create_access_token(user), new_raw


async def revoke(session: AsyncSession, raw: str) -> None:
    await session.execute(
        update(RefreshToken)
        .where(
            RefreshToken.token_hash == hash_refresh_token(raw),
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(timezone.utc))
        .execution_options(synchronize_session=False)
    )
    await session.commit()
