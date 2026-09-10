"""
Визначення IP відвідувача за reverse proxy (Завдання 24 — обмеження частоти).

Чому окремі тести: на проді застосунок стоїть за Caddy, і `request.client`
там порожній. Через це rate limiter клав усіх у спільний кошик "unknown" —
ліміт ставав спільним на весь сайт, а обмеження на /api/auth дозволяло одній
людині заблокувати вхід усім іншим.
"""

from starlette.requests import Request

from app.middleware import client_ip


def make_request(headers: dict[str, str], client: tuple[str, int] | None) -> Request:
    return Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "GET",
            "path": "/api/markets",
            "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
            "client": client,
        }
    )


class TestClientIp:
    def test_direct_connection_uses_peer_address(self):
        """Без проксі (локальна розробка) беремо адресу з'єднання."""
        assert client_ip(make_request({}, ("198.51.100.4", 51234))) == "198.51.100.4"

    def test_missing_client_falls_back(self):
        """Саме цей випадок і був на проді: uvicorn писав у лозі None:0."""
        assert client_ip(make_request({}, None)) == "unknown"

    def test_forwarded_header_wins(self):
        """За проксі справжня адреса приходить у X-Forwarded-For."""
        req = make_request({"X-Forwarded-For": "203.0.113.7"}, None)
        assert client_ip(req) == "203.0.113.7"

    def test_forwarded_list_takes_first(self):
        """Caddy перезаписує заголовок, але формат допускає список."""
        req = make_request({"X-Forwarded-For": "203.0.113.7, 10.0.0.1"}, ("127.0.0.1", 1))
        assert client_ip(req) == "203.0.113.7"

    def test_empty_forwarded_falls_back_to_peer(self):
        req = make_request({"X-Forwarded-For": "  "}, ("127.0.0.1", 1))
        assert client_ip(req) == "127.0.0.1"

    def test_different_visitors_get_different_keys(self):
        """
        Суть виправлення: два відвідувачі за одним проксі мають різні ключі.
        Раніше обидва давали "unknown" і ділили один ліміт на двох.
        """
        a = client_ip(make_request({"X-Forwarded-For": "203.0.113.7"}, None))
        b = client_ip(make_request({"X-Forwarded-For": "198.51.100.9"}, None))
        assert a != b
