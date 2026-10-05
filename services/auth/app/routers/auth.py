from fastapi import APIRouter, status

from app.schemas import MessageResponse, OtpRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/otp/request",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=MessageResponse,
)
async def request_otp(body: OtpRequest) -> MessageResponse:
    return MessageResponse(message="If that email is valid, a code has been sent.")