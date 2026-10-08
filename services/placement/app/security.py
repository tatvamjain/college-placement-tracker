import uuid
from dataclasses import dataclass
from pathlib import Path

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

ALGORITHM = "EdDSA"
ADMIN_ROLE = "admin"
_PUBLIC_KEY = Path(settings.jwt_public_key_path).read_text()
_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Admin:
    user_id: uuid.UUID


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def require_admin(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> Admin:
    if creds is None:
        raise _unauthorized("Missing token")
    try:
        claims = jwt.decode(
            creds.credentials,
            _PUBLIC_KEY,
            algorithms=[ALGORITHM],
            issuer=settings.jwt_issuer,
            options={"require": ["exp", "iss", "sub", "role", "typ"]},
        )
    except jwt.ExpiredSignatureError:
        raise _unauthorized("Token expired")
    except jwt.InvalidTokenError:
        raise _unauthorized("Invalid token")

    if claims["typ"] != "access":
        raise _unauthorized("Invalid token")
    if claims["role"] != ADMIN_ROLE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins only")
    return Admin(user_id=uuid.UUID(claims["sub"]))