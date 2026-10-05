import hashlib
import hmac
import secrets

from app.config import settings


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(email: str, code: str) -> str:
    message = f"{email.lower()}:{code}".encode()
    return hmac.new(settings.otp_hmac_key.encode(), message, hashlib.sha256).hexdigest()


def verify_otp(email: str, code: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_otp(email, code), stored_hash)