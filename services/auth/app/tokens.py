import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt

from app.config import settings
from app.models import User

ALGORITHM = "EdDSA"
_PRIVATE_KEY = Path(settings.jwt_private_key_path).read_text()
_PUBLIC_KEY = Path(settings.jwt_public_key_path).read_text()


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        "sub": str(user.id),
        "pid": str(user.pseudonym.pseudo_id),
        "role": user.role.value,
        "iss": settings.jwt_issuer,
        "iat": now,
        "exp": now + timedelta(seconds=settings.access_token_ttl_seconds),
        "jti": str(uuid.uuid4()),
        "typ": "access",
    }
    return jwt.encode(claims, _PRIVATE_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    claims = jwt.decode(
        token,
        _PUBLIC_KEY,
        algorithms=[ALGORITHM],
        issuer=settings.jwt_issuer,
        options={"require": ["sub", "role", "iss", "iat", "exp"]},
    )
    if claims.get("typ") != "access":
        raise jwt.InvalidTokenError("Not an access token")
    return claims


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def new_refresh_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(32)
    return raw, hash_refresh_token(raw)
