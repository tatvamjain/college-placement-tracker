from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_session
from app.schemas import MessageResponse, OtpRequest, OtpVerify, VerifyResponse
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


@router.post("/otp/verify", response_model=VerifyResponse)
async def verify_otp(
    body: OtpVerify, session: AsyncSession = Depends(get_session)
) -> VerifyResponse:
    try:
        await otp_service.verify_otp_code(body.email, body.code)
    except otp_service.InvalidCode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code"
        )

    async with session.begin():
        user, created = await users.get_or_create_verified_user(session, body.email)

    if users.is_banned(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended")

    return VerifyResponse(display_name=user.pseudonym.display_name, is_new_user=created)