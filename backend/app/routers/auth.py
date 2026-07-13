"""
Реєстрація та авторизація. Завдання 13.

    POST /api/auth/register   {email, password} -> {token, user}
    POST /api/auth/login      {email, password} -> {token, user}
    GET  /api/auth/me         (Bearer token)    -> {user}

Вихід (logout) — на боці клієнта: видалення токена. JWT — stateless.
"""

import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.db_models import User
from app.security import (
    MIN_PASSWORD_LENGTH,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

bearer_scheme = HTTPBearer(auto_error=False)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class Credentials(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., max_length=128)


def user_public(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "createdAt": user.created_at.isoformat() if user.created_at else None,
    }


# ---- dependency: поточний користувач із Bearer-токена ----

async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_session),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---- endpoints ----

@router.post("/register")
async def register(body: Credentials, session: AsyncSession = Depends(get_session)):
    email = body.email.strip().lower()

    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    if len(body.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters long.",
        )

    existing = await session.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    user = User(email=email, password_hash=hash_password(body.password))
    session.add(user)
    await session.commit()
    await session.refresh(user)

    return {"token": create_access_token(user.id), "user": user_public(user)}


@router.post("/login")
async def login(body: Credentials, session: AsyncSession = Depends(get_session)):
    email = body.email.strip().lower()

    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    # Одна й та сама помилка для "немає юзера" і "неправильний пароль" —
    # не підказуємо, які email зареєстровані (Завдання 24).
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    return {"token": create_access_token(user.id), "user": user_public(user)}


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return {"user": user_public(user)}
