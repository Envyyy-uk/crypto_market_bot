"""
Таблиці бази даних — усі 5 з Завдання 19.

Users, FavouriteAssets, Alerts і PushSubscriptions наповнюватимуться
в Завданнях 12-15; Signals починає працювати одразу (Завдання 20).
"""

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    notification_settings: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class FavouriteAsset(Base):
    __tablename__ = "favourite_assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0)  # порядок у списку (Завдання 12)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Signal(Base):
    __tablename__ = "signals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    timeframe: Mapped[str] = mapped_column(String(5), index=True, nullable=False)
    signal_type: Mapped[str] = mapped_column(String(15), index=True, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(10), nullable=False)
    reasons: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON-масив рядків
    # Результати після сигналу (Завдання 21) — заповнюються пізніше
    price_after_15m: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_after_1h: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_after_4h: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_rise_pct: Mapped[float | None] = mapped_column(Float, nullable=True)  # макс. зростання за 4h
    max_drop_pct: Mapped[float | None] = mapped_column(Float, nullable=True)  # макс. падіння за 4h
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    condition_type: Mapped[str] = mapped_column(String(30), nullable=False)  # price_above, rsi_below, signal_change...
    condition_value: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Заповнюються, коли сповіщення спрацювало (one-shot)
    fired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    fired_value: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    subscription_data: Mapped[str] = mapped_column(Text, nullable=False)  # JSON
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
