from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../../.env", extra="ignore")

    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: str
    placement_url: str = "http://localhost:8002"


settings = Settings()