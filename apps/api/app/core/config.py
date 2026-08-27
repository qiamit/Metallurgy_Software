from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "Metallurgy Software API"
    environment: str = "development"
    secret_key: str = "change-me-in-production-metallurgy-saas-secret"
    access_token_expire_minutes: int = 60 * 24
    algorithm: str = "HS256"

    database_url: str = "sqlite+aiosqlite:///./metallurgy.db"
    redis_url: str = "redis://localhost:6379/0"

    def model_post_init(self, __context: object) -> None:
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        # asyncpg SSL often fails on Railway private networking without certs
        if "ssl=" not in url and url.startswith("postgresql+asyncpg://"):
            sep = "&" if "?" in url else "?"
            url = f"{url}{sep}ssl=disable"
        object.__setattr__(self, "database_url", url)

    storage_backend: str = "local"  # local | s3
    local_storage_path: str = "./storage"
    s3_endpoint: str | None = None
    s3_access_key: str | None = None
    s3_secret_key: str | None = None
    s3_bucket: str = "metallurgy-media"
    s3_region: str = "auto"

    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
