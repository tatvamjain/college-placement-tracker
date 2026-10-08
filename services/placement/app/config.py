from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../../.env", extra="ignore")

    placement_db_user: str
    placement_db_password: str
    db_host: str = "localhost"
    db_port: int = 5433
    db_name: str = "placement_db"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.placement_db_user}:{self.placement_db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


settings = Settings()