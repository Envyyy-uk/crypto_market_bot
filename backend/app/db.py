"""
Підключення до бази даних. Завдання 19.

Локальна розробка: SQLite (файл crypto_bot.db, нічого встановлювати не треба).
Продакшн: PostgreSQL — просто задайте DATABASE_URL у .env, напр.:
    DATABASE_URL=postgresql+asyncpg://user:password@host:5432/crypto_bot
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

logger = logging.getLogger("db")


class Base(DeclarativeBase):
    pass


engine = create_async_engine(settings.database_url, echo=False)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

db_connected: bool = False


async def init_db() -> None:
    """Створити таблиці, якщо їх ще немає. Викликається при старті застосунку."""
    global db_connected
    # Імпорт тут, щоб моделі зареєструвалися в Base.metadata
    from app.models import db_models  # noqa: F401

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            # Міні-міграція: create_all не додає нові колонки в наявні таблиці.
            # ALTER-и ідемпотентні через try/except (колонка вже є -> ігноруємо).
            for ddl in (
                "ALTER TABLE signals ADD COLUMN max_rise_pct FLOAT",
                "ALTER TABLE signals ADD COLUMN max_drop_pct FLOAT",
                "ALTER TABLE alerts ADD COLUMN fired_at TIMESTAMP",
                "ALTER TABLE alerts ADD COLUMN fired_value VARCHAR(50)",
            ):
                try:
                    await conn.exec_driver_sql(ddl)
                except Exception:
                    pass  # колонка вже існує
        db_connected = True
        logger.info("Database initialized (%s)", settings.database_url.split("://")[0])
    except Exception as exc:
        db_connected = False
        logger.error("Database initialization failed: %s", exc)


async def get_session() -> AsyncSession:
    """FastAPI dependency."""
    async with SessionLocal() as session:
        yield session
