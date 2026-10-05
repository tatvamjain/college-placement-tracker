from app.config import settings
from app.otp import generate_otp, hash_otp, verify_otp
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

class InvalidCode(Exception):
    pass


async def verify_otp_code(email: str, code: str) -> None:
    key = _code_key(email)

    async with redis.pipeline(transaction=True) as pipe:
        pipe.hincrby(key, "attempts", 1)
        pipe.hget(key, "hash")
        attempts, stored_hash = await pipe.execute()

    if stored_hash is None:
        await redis.delete(key)
        raise InvalidCode

    if attempts > settings.otp_max_attempts:
        await redis.delete(key)
        raise InvalidCode

    if not verify_otp(email, code, stored_hash):
        raise InvalidCode

    if await redis.delete(key) == 0:
        raise InvalidCode