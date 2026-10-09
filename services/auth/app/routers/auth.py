from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.cookies import REFRESH_COOKIE, clear_auth_cookies, set_auth_cookies
from app.deps import get_current_claims, get_session
from app.schemas import (
    MessageResponse, OtpRequest, OtpVerify, RefreshRequest, RefreshResponse, TokenResponse,
)
from app.services import otp_service, refresh_service, users
import uuid

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models import User
from app.schemas import MeResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/otp/request",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=MessageResponse,
)
async def request_otp(body: OtpRequest) -> MessageResponse:
    try:
        await otp_service.request_otp(body.email)
    except otp_service.TooManyRequests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many code requests. Try again in a few minutes.",
        )
    return MessageResponse(message="If that email is valid, a code has been sent.")


@router.post("/otp/verify", response_model=TokenResponse)
async def verify_otp(
    body: OtpVerify,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    try:
        await otp_service.verify_otp_code(body.email, body.code)
    except otp_service.InvalidCode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code"
        )

    async with session.begin():
        user, created = await users.get_or_create_verified_user(session, body.email)
        if users.is_banned(user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended"
            )
        access, refresh = users.issue_tokens(
            session, user, request.headers.get("user-agent", "")
        )

    set_auth_cookies(response, access, refresh)
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.access_token_ttl_seconds,
        display_name=user.pseudonym.display_name,
        is_new_user=created,
    )


@router.get("/me", response_model=MeResponse)
async def me(
    claims: dict = Depends(get_current_claims), session: AsyncSession = Depends(get_session)
) -> MeResponse:
    user = await session.scalar(
        select(User).options(selectinload(User.pseudonym)).where(User.id == uuid.UUID(claims["sub"]))
    )
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return MeResponse(
        user_id=claims["sub"],
        pseudo_id=claims["pid"],
        role=claims["role"],
        email=user.email,
        display_name=user.pseudonym.display_name,
    )

@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    request: Request,
    response: Response,
    body: RefreshRequest | None = None,
    session: AsyncSession = Depends(get_session),
) -> RefreshResponse:
    from_cookie = body is None
    token = request.cookies.get(REFRESH_COOKIE) if from_cookie else body.refresh_token
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not logged in")
    try:
        access, new_refresh = await refresh_service.rotate(session, token)
    except refresh_service.InvalidRefreshToken:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token"
        )
    except refresh_service.UserBanned:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account suspended")

    if from_cookie:
        set_auth_cookies(response, access, new_refresh)
        return RefreshResponse()
    return RefreshResponse(access_token=access, refresh_token=new_refresh)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    body: RefreshRequest | None = None,
    session: AsyncSession = Depends(get_session),
) -> Response:
    token = body.refresh_token if body else request.cookies.get(REFRESH_COOKIE)
    if token:
        await refresh_service.revoke(session, token)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_auth_cookies(response)
    return response