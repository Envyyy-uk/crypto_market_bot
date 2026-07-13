"""
Тести API-ендпоінтів (Завдання 25). Мережа/біржа не потрібні:
перевіряється валідація, яка спрацьовує ДО звернення до Bybit.

Запуск:
    cd backend
    pytest tests/ -v
"""

from fastapi.testclient import TestClient

from app.main import app

# Без контекст-менеджера lifespan не запускається:
# фонові сервіси і БД не стартують — тестуємо чисту маршрутизацію/валідацію.
client = TestClient(app, raise_server_exceptions=False)


class TestHealth:
    def test_health_shape(self):
        res = client.get("/health")
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "online"
        assert "exchangeConnection" in body
        assert "database" in body
        assert body["trackedPairs"] > 0


class TestValidation:
    def test_unknown_symbol_404(self):
        res = client.get("/api/candles/NOTACOIN")
        assert res.status_code == 404

    def test_invalid_interval_400(self):
        res = client.get("/api/candles/BTCUSDT?interval=7m")
        assert res.status_code == 400

    def test_limit_bounds_422(self):
        res = client.get("/api/candles/BTCUSDT?interval=1h&limit=5000")
        assert res.status_code == 422  # ge/le валідація FastAPI

    def test_backtest_unknown_symbol_404(self):
        res = client.get("/api/backtest/NOTACOIN")
        assert res.status_code == 404

    def test_analyze_invalid_interval_400(self):
        res = client.get("/api/analyze/BTCUSDT?interval=2w")
        assert res.status_code == 400


class TestAuthGuards:
    def test_favourites_require_token(self):
        assert client.get("/api/favourites").status_code == 401

    def test_alerts_require_token(self):
        assert client.get("/api/alerts").status_code == 401

    def test_garbage_token_rejected(self):
        res = client.get(
            "/api/favourites", headers={"Authorization": "Bearer not.a.real.token"}
        )
        assert res.status_code == 401


class TestSecurityHeaders:
    def test_headers_present(self):
        res = client.get("/health")
        assert res.headers.get("X-Content-Type-Options") == "nosniff"
        assert res.headers.get("X-Frame-Options") == "DENY"
