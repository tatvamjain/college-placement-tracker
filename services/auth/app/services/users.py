import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import AuthOutbox, Pseudonym, User
from app.pseudonyms import unique_display_name


async def get_or_create_verified_user(session: AsyncSession, email: str) -> tuple[User, bool]:
    now = datetime.now(timezone.utc)

    user = await session.scalar(
        select(User).options(selectinload(User.pseudonym)).where(User.email == email)
    )
    if user is not None:
        if user.verified_at is None:
            user.verified_at = now
        return user, False

    user = User(email=email, verified_at=now)
    pseudonym = Pseudonym(user=user, display_name=await unique_display_name(session))
    session.add_all([user, pseudonym])
    await session.flush()

    session.add(
        AuthOutbox(
            event_type="UserVerified",
            payload={
                "event_id": str(uuid.uuid4()),
                "event_type": "UserVerified",
                "version": 1,
                "occurred_at": now.isoformat(),
                "producer": "auth-service",
                "data": {"user_id": str(user.id), "pseudo_id": str(pseudonym.pseudo_id)},
            },
        )
    )
    return user, True


def is_banned(user: User) -> bool:
    return user.banned_until is not None and user.banned_until > datetime.now(timezone.utc)

from datetime import timedelta

from app.config import settings
from app.models import RefreshToken
from app.tokens import create_access_token, new_refresh_token


def issue_tokens(session: AsyncSession, user: User, device_info: str) -> tuple[str, str]:
    raw_refresh, refresh_hash = new_refresh_token()
    session.add(
        RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            device_info=device_info[:255] or None,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_ttl_days),
        )
    )
    return create_access_token(user), raw_refresh