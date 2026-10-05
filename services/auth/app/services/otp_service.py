from app.config import settings
from app.otp import generate_otp, hash_otp
from app.redis_client import redis
from app.services.email import send_otp_email


class TooManyRequests(Exception):
    pass


def _code_key(email: str) -> str:
    return f"otp:code:{email}"


def _rate_key(email: str) -> str:
    return f"otp:rl:{email}"


async def request_otp(email: str) -> None:
    async with redis.pipeline(transaction=True) as pipe:
        pipe.incr(_rate_key(email))
        pipe.expire(_rate_key(email), settings.otp_window_seconds, nx=True)
        count, _ = await pipe.execute()

    if count > settings.otp_requests_per_window:
        raise TooManyRequests

    code = generate_otp()
    async with redis.pipeline(transaction=True) as pipe:
        pipe.hset(_code_key(email), mapping={"hash": hash_otp(email, code), "attempts": 0})
        pipe.expire(_code_key(email), settings.otp_ttl_seconds)
        await pipe.execute()

    await send_otp_email(email, code)