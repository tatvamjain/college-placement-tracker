import uuid
from dataclasses import dataclass
from pathlib import Path

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

ALGORITHM = "EdDSA"
ADMIN_ROLE = "admin"
ACCESS_COOKIE = "access_token"  # must match auth's cookie name
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
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
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> Admin:
    if creds is not None:
        token = creds.credentials
    else:
        token = request.cookies.get(ACCESS_COOKIE)
        if token is None:
            raise _unauthorized("Missing token")
        if request.method not in SAFE_METHODS and request.headers.get("x-csrf") != "1":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Missing CSRF header")
    try:
        claims = jwt.decode(
            token,
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