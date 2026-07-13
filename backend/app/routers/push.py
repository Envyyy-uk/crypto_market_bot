"""
Web Push. Завдання 15.

    GET    /api/push/public-key   — VAPID public key для PushManager.subscribe
    POST   /api/push/subscribe    — зберегти підписку пристрою
    DELETE /api/push/subscribe    — видалити підписку (за endpoint)

Надсилання: send_push_to_user() — викликається alert_checker-ом.

VAPID-ключі генеруються один раз:
    cd backend && python scripts/generate_vapid.py
і додаються в .env (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT).
Без ключів push вимкнено, решта застосунку працює.
"""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import SessionLocal, get_session
from app.models.db_models import PushSubscription, User
from app.routers.auth import get_current_user

logger = logging.getLogger("push")
router = APIRouter(prefix="/push", tags=["push"])

try:
    from pywebpush import WebPushException, webpush
    PUSH_AVAILABLE = True
except ImportError:
    PUSH_AVAILABLE = False
    logger.warning("pywebpush is not installed — push delivery disabled")


def push_configured() -> bool:
    return PUSH_AVAILABLE and bool(settings.vapid_public_key and settings.vapid_private_key)


class SubscriptionBody(BaseModel):
    subscription: dict  # об'єкт PushSubscription.toJSON() із браузера


@router.get("/public-key")
def get_public_key():
    if not push_configured():
        raise HTTPException(
            status_code=503,
            detail="Push notifications are not configured on this server.",
        )
    return {"publicKey": settings.vapid_public_key}


@router.post("/subscribe")
async def subscribe(
    body: SubscriptionBody,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    endpoint = body.subscription.get("endpoint")
    if not endpoint or "keys" not in body.subscription:
        raise HTTPException(status_code=400, detail="Invalid push subscription payload.")

    # Один запис на endpoint: пере-підписка того самого пристрою оновлює дані
    existing = await session.execute(
        select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    )
    sub = existing.scalar_one_or_none()
    if sub:
        sub.user_id = user.id
        sub.subscription_data = json.dumps(body.subscription)
    else:
        session.add(
            PushSubscription(
                user_id=user.id,
                endpoint=endpoint,
                subscription_data=json.dumps(body.subscription),
            )
        )
    await session.commit()
    return {"subscribed": True}


@router.delete("/subscribe")
async def unsubscribe(
    body: SubscriptionBody,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    endpoint = body.subscription.get("endpoint")
    if not endpoint:
        raise HTTPException(status_code=400, detail="Invalid push subscription payload.")
    await session.execute(
        delete(PushSubscription).where(
            PushSubscription.endpoint == endpoint,
            PushSubscription.user_id == user.id,
        )
    )
    await session.commit()
    return {"subscribed": False}


# ---------- надсилання ----------

async def send_push_to_user(user_id: int, title: str, message: str, symbol: str) -> None:
    """
    Нотифікатор для alert_checker: надіслати push на всі пристрої користувача.
    Прострочені підписки (410 Gone) видаляються автоматично.
    """
    if not push_configured():
        return

    async with SessionLocal() as session:
        result = await session.execute(
            select(PushSubscription).where(PushSubscription.user_id == user_id)
        )
        subs = list(result.scalars().all())

        payload = json.dumps(
            {
                "title": title,
                "body": message,
                "url": f"/analyze/{symbol}",
                "tag": f"alert-{symbol}",
            }
        )

        for sub in subs:
            try:
                webpush(
                    subscription_info=json.loads(sub.subscription_data),
                    data=payload,
                    vapid_private_key=settings.vapid_private_key,
                    vapid_claims={"sub": settings.vapid_subject},
                )
            except WebPushException as exc:
                status = getattr(exc.response, "status_code", None)
                if status in (404, 410):
                    await session.delete(sub)  # пристрій відписався
                else:
                    logger.warning("Push failed for user %s: %s", user_id, exc)
            except Exception as exc:
                logger.warning("Push failed for user %s: %s", user_id, exc)

        await session.commit()
