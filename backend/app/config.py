"""
Централізована конфігурація. Значення читаються з .env (див. .env.example).
Ніколи не хардкодимо секрети — Завдання 24 (Безпека).
"""

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Анкеримо шлях SQLite-файлу до backend/, а не до cwd процесу — uvicorn можуть
# запускати з різних місць (--app-dir, systemd, тощо).
_DEFAULT_SQLITE_PATH = Path(__file__).resolve().parent.parent / "crypto_bot.db"


class Settings:
    # Дозволені джерела для CORS (frontend dev-сервер за замовчуванням)
    cors_origins: list[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
    ).split(",")

    # Біржа, з якою працюємо в першу чергу
    exchange_name: str = os.getenv("EXCHANGE_NAME", "bybit")

    # Публічний REST endpoint (не потребує ключів для читання цін)
    bybit_rest_url: str = os.getenv("BYBIT_REST_URL", "https://api.bybit.com")

    # WebSocket endpoint біржі, spot-канал (знадобиться в Завданні 4)
    bybit_ws_url: str = os.getenv("BYBIT_WS_URL", "wss://stream.bybit.com/v5/public/spot")

    # База даних (Завдання 19).
    # Локально за замовчуванням SQLite — працює без установки.
    # На проді задайте в .env: postgresql+asyncpg://user:password@host:5432/crypto_bot
    database_url: str = os.getenv(
        "DATABASE_URL", f"sqlite+aiosqlite:///{_DEFAULT_SQLITE_PATH.as_posix()}"
    )

    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Секрет для JWT (Завдання 13) — обов'язково змінити в .env
    jwt_secret: str = os.getenv("JWT_SECRET", "CHANGE_ME_IN_ENV")

    # Web Push / VAPID (Завдання 15). Генерація: python scripts/generate_vapid.py
    vapid_public_key: str = os.getenv("VAPID_PUBLIC_KEY", "")
    vapid_private_key: str = os.getenv("VAPID_PRIVATE_KEY", "")
    vapid_subject: str = os.getenv("VAPID_SUBJECT", "mailto:admin@example.com")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
