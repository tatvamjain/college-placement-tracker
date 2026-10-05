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
    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.auth_db_user}:{self.auth_db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


settings = Settings()