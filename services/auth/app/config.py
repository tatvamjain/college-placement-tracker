from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../../.env", extra="ignore")

    auth_db_user: str
    auth_db_password: str
    db_host: str = "localhost"
    db_port: int = 5433
    db_name: str = "auth_db"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.auth_db_user}:{self.auth_db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


settings = Settings()