import logging

from app.config import settings

logger = logging.getLogger("auth.email")


async def send_otp_email(email: str, code: str) -> None:
    if settings.environment == "dev":
        print(f"[DEV ONLY] OTP for {email}: {code}", flush=True)
        return
    raise NotImplementedError("Real email provider not configured yet")
