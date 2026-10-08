from collections.abc import AsyncIterator
from app.cookies import ACCESS_COOKIE
import jwt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import UserRole
from app.db import SessionLocal
from app.tokens import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


async def get_current_claims(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    if credentials is not None:
        token = credentials.credentials
    else:
        token = request.cookies.get(ACCESS_COOKIE)
        if token is None:
            raise _unauthorized("Not authenticated")
        if request.method not in SAFE_METHODS and request.headers.get("x-csrf") != "1":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Missing CSRF header")
    try:
        return decode_access_token(token)
    except jwt.ExpiredSignatureError:
        raise _unauthorized("Token expired")
    except jwt.InvalidTokenError:
        raise _unauthorized("Invalid token")
    
def require_role(*roles: UserRole):
    allowed = {r.value for r in roles}

    async def checker(claims: dict = Depends(get_current_claims)) -> dict:
        if claims["role"] not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return claims

    return checker
