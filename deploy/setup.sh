#!/usr/bin/env bash
#
# Розгортання Crypto Market Bot на чистому Ubuntu 24.04 (Hetzner Cloud).
# Запускати від root на СВІЖОМУ сервері:
#
#   git clone https://github.com/Envyyy-uk/crypto_market_bot /tmp/cmb
#   sudo bash /tmp/cmb/deploy/setup.sh bot.example.duckdns.org
#
# Аргумент — домен, який уже вказує A-записом на IP цього сервера.
# Без домену Let's Encrypt не видасть сертифікат, а без HTTPS не працюють
# ні встановлення PWA, ні push.

set -euo pipefail

SITE_HOST="${1:-}"
REPO_URL="${2:-https://github.com/Envyyy-uk/crypto_market_bot.git}"
APP_DIR=/opt/crypto-market-bot
APP_USER=cryptobot

if [[ -z "$SITE_HOST" ]]; then
	echo "Використання: sudo bash setup.sh <домен> [git-url]" >&2
	exit 1
fi
if [[ $EUID -ne 0 ]]; then
	echo "Запускайте від root (sudo)." >&2
	exit 1
fi

echo "==> 1/8 Пакети"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl ufw logrotate caddy \
	python3 python3-venv python3-dev build-essential nodejs npm sqlite3

echo "==> 2/8 Користувач і код"
# Системний користувач без права входу: сервіс не має бути root.
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
if [[ -d "$APP_DIR/.git" ]]; then
	git -C "$APP_DIR" pull --ff-only
else
	git clone "$REPO_URL" "$APP_DIR"
fi

echo "==> 3/8 Python-оточення"
python3 -m venv "$APP_DIR/backend/venv"
"$APP_DIR/backend/venv/bin/pip" install -q --upgrade pip
"$APP_DIR/backend/venv/bin/pip" install -q -r "$APP_DIR/backend/requirements.txt"

echo "==> 4/8 Конфігурація"
ENV_FILE="$APP_DIR/backend/.env"
if [[ -f "$ENV_FILE" ]]; then
	echo "    .env уже існує — не чіпаю (секрети збережено)"
else
	# Історичні свічки: з різних країн доступні різні дзеркала Binance
	# (див. коментар у backend/app/services/candles.py). Замість того щоб
	# гадати — перевіряємо звідси і беремо те, що реально відповідає.
	BINANCE_URL=https://api.binance.com
	for candidate in https://api.binance.com https://api.binance.us; do
		code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
			"$candidate/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=1" || true)
		echo "    $candidate -> HTTP $code"
		if [[ "$code" == "200" ]]; then BINANCE_URL="$candidate"; break; fi
	done

	cat > "$ENV_FILE" <<ENVEOF
# Згенеровано deploy/setup.sh $(date -u +%Y-%m-%dT%H:%M:%SZ)

# Фронтенд і API за одним доменом, тож CORS фактично не задіяний;
# лишаємо власний домен на випадок звернень з іншого джерела.
CORS_ORIGINS=https://$SITE_HOST

EXCHANGE_NAME=bybit
BYBIT_REST_URL=https://api.bybit.com
BYBIT_WS_URL=wss://stream.bybit.com/v5/public/spot
BINANCE_REST_URL=$BINANCE_URL

# SQLite поруч із застосунком; systemd відкриває на запис лише цю теку.
REDIS_URL=redis://localhost:6379/0

JWT_SECRET=$(openssl rand -hex 32)
ENVEOF

	# VAPID-ключі для Web Push — витягуємо готові рядки з наявного скрипта.
	(cd "$APP_DIR/backend" && ./venv/bin/python scripts/generate_vapid.py) \
		| grep -E '^VAPID_(PUBLIC|PRIVATE)_KEY=' >> "$ENV_FILE"
	echo "VAPID_SUBJECT=mailto:admin@$SITE_HOST" >> "$ENV_FILE"
	chmod 600 "$ENV_FILE"
fi

echo "==> 5/8 Збірка фронтенду"
# VITE_API_BASE порожній = "той самий origin": фронт звертається до /api та
# /ws відносними шляхами через Caddy. Не прибирайте знак "=", інакше збірка
# візьме дефолт http://localhost:8000 і на сервері нічого не працюватиме.
(cd "$APP_DIR/frontend" && npm ci --no-audit --no-fund && VITE_API_BASE= npm run build)

chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> 6/8 systemd"
install -m 644 "$APP_DIR/deploy/cryptobot.service" /etc/systemd/system/cryptobot.service
install -m 644 "$APP_DIR/deploy/cryptobot.logrotate" /etc/logrotate.d/cryptobot
systemctl daemon-reload
systemctl enable --now cryptobot

echo "==> 7/8 Caddy"
sed "s|^SITE_HOST {|$SITE_HOST {|" "$APP_DIR/deploy/Caddyfile" > /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl restart caddy

echo "==> 8/8 Фаєрвол"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

echo
echo "Готово. Перевірте:"
echo "  https://$SITE_HOST/health   -> status online, exchange/database connected"
echo "  https://$SITE_HOST/         -> ціни оновлюються без перезавантаження"
echo
echo "Логи:   journalctl -u cryptobot -f"
echo "Caddy:  journalctl -u caddy -f"
echo "Перший запит по HTTPS може зайняти кілька секунд — Caddy отримує сертифікат."
