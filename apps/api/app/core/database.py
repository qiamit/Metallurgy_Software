from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.models.db import Base

settings = get_settings()

connect_args: dict = {}
if settings.database_url.startswith("postgresql+asyncpg://"):
    connect_args = {"ssl": False, "timeout": 5}

engine = create_async_engine(
    settings.database_url.split("?")[0],
    echo=False,
    future=True,
    connect_args=connect_args,
    pool_pre_ping=True,
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def init_db() -> None:
    import asyncio

    last_error: Exception | None = None
    for attempt in range(1, 4):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            print("Database schema ready")
            return
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            print(f"DB init attempt {attempt} failed: {exc}")
            await asyncio.sleep(2)
    print(f"WARNING: Database init failed after retries: {last_error}")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
