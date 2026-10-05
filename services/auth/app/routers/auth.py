from fastapi import APIRouter, HTTPException, status

from app.schemas import MessageResponse, OtpRequest
from app.services import otp_service

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