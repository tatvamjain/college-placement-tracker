from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../../.env", extra="ignore")

    auth_db_user: str
    auth_db_password: str
    db_host: str = "localhost"
    db_port: int = 5433
    db_name: str = "auth_db"
    allowed_email_domain: str = "thapar.edu"
    environment: str = "dev"

    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: str

    otp_hmac_key: str
    otp_ttl_seconds: int = 300
    otp_max_attempts: int = 5
    otp_requests_per_window: int = 3
    otp_window_seconds: int = 600

    jwt_private_key_path: str = "../../secrets/jwt_private.pem"
    jwt_public_key_path: str = "../../secrets/jwt_public.pem"
    jwt_issuer: str = "auth-service"
    access_token_ttl_seconds: int = 900
    refresh_token_ttl_days: int = 30

    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    refresh_cookie_path: str = "/api/auth/auth"
    refresh_cookie_max_age: int = 60 * 60 * 24 * 30
    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.auth_db_user}:{self.auth_db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


settings = Settings()
