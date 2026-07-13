"""
Middleware безпеки. Завдання 24.

RateLimitMiddleware — обмеження кількості запитів (ковзне вікно, у пам'яті):
    * загальні API-запити:  120 / хвилину з однієї IP
    * /api/auth/*:           10 / хвилину з однієї IP (перебір паролів)
    * /api/backtest/*:        6 / хвилину з однієї IP (важкі обчислення)

Для одного інстанса цього достатньо; при горизонтальному масштабуванні
лічильники варто перенести в Redis — інтерфейс лишиться той самий.

SecurityHeadersMiddleware — базові захисні заголовки відповіді.
"""

import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

WINDOW_SEC = 60

LIMITS = [
    ("/api/auth/", 10),
    ("/api/backtest/", 6),
    ("/api/", 120),
]


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        # (ip, префікс) -> deque з часами запитів
        self._hits: dict[tuple[str, str], deque] = defaultdict(deque)

    def _limit_for(self, path: str) -> tuple[str, int] | None:
        for prefix, limit in LIMITS:
            if path.startswith(prefix):
                return prefix, limit
        return None

    async def dispatch(self, request: Request, call_next):
        rule = self._limit_for(request.url.path)
        if rule is None:
            return await call_next(request)

        prefix, limit = rule
        ip = request.client.host if request.client else "unknown"
        key = (ip, prefix)
        now = time.monotonic()

        hits = self._hits[key]
        while hits and now - hits[0] > WINDOW_SEC:
            hits.popleft()

        if len(hits) >= limit:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down and try again."},
                headers={"Retry-After": str(WINDOW_SEC)},
            )

        hits.append(now)
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        return response
