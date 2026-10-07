from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.deps import get_current_claims, get_session
from app.schemas import MessageResponse, OtpRequest, OtpVerify, TokenResponse
from app.services import otp_service, users

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
    body: OtpVerify, request: Request, session: AsyncSession = Depends(get_session)
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

    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.access_token_ttl_seconds,
        display_name=user.pseudonym.display_name,
        is_new_user=created,
    )


@router.get("/me")
async def me(claims: dict = Depends(get_current_claims)) -> dict:
    return {
        "user_id": claims["sub"],
        "pseudo_id": claims["pid"],
        "role": claims["role"],
    }


from fastapi import Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_session
from app.schemas import RefreshRequest, RefreshResponse
from app.services import refresh_service


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    body: RefreshRequest, session: AsyncSession = Depends(get_session)
) -> RefreshResponse:
    try:
        access, new_refresh = await refresh_service.rotate(session, body.refresh_token)
    except refresh_service.InvalidRefreshToken:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token"
        )
    except refresh_service.UserBanned:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account suspended")
    return RefreshResponse(access_token=access, refresh_token=new_refresh)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: RefreshRequest, session: AsyncSession = Depends(get_session)
) -> Response:
    await refresh_service.revoke(session, body.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
