import asyncio
import logging
import smtplib
from email.message import EmailMessage

from fastapi import HTTPException

from app.config import settings

logger = logging.getLogger("auth.email")


def _send(email: str, code: str) -> None:
    msg = EmailMessage()
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = email
    msg["Subject"] = f"{code} is your Placement Board code"
    msg.set_content(
        f"Your login code is {code}\n\n"
        "It expires in a few minutes. If you didn't ask for it, ignore this email."
    )
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        smtp.starttls()
        smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(msg)


async def send_otp_email(email: str, code: str) -> None:
    if not settings.smtp_host:
        if settings.environment == "dev":
            print(f"[DEV ONLY] OTP for {email}: {code}", flush=True)
            return
        raise RuntimeError("SMTP_HOST must be set outside dev")
    try:
        await asyncio.to_thread(_send, email, code)
    except (smtplib.SMTPException, OSError):
        logger.exception("sending OTP email failed")
        raise HTTPException(503, "Couldn't send the email. Try again in a minute.")