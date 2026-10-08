from fastapi import Response

from app.config import settings

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"


def set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    secure = settings.environment != "dev"
    response.set_cookie(
        ACCESS_COOKIE, access, max_age=settings.access_token_ttl_seconds,
        httponly=True, secure=secure, samesite="lax", path="/",
    )
    response.set_cookie(
        REFRESH_COOKIE, refresh, max_age=settings.refresh_cookie_max_age,
        httponly=True, secure=secure, samesite="strict", path=settings.refresh_cookie_path,
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path=settings.refresh_cookie_path)