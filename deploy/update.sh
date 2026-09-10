#!/usr/bin/env bash
#
# Оновлення вже розгорнутого сервера: підтягнути код, перезібрати, перезапустити.
#   sudo bash /opt/crypto-market-bot/deploy/update.sh
#
# .env не чіпається — секрети переживають оновлення.

set -euo pipefail

APP_DIR=/opt/crypto-market-bot
APP_USER=cryptobot

[[ $EUID -eq 0 ]] || { echo "Запускайте від root (sudo)." >&2; exit 1; }

# Репозиторій належить користувачу cryptobot (setup.sh віддає йому теку),
# а скрипт працює від root. Git від версії 2.35.2 відмовляється чіпати
# репозиторій із "чужим" власником — саме на цьому падав update.sh із
# "detected dubious ownership". Позначаємо теку довіреною явно.
git config --global --get-all safe.directory 2>/dev/null | grep -qx "$APP_DIR" \
	|| git config --global --add safe.directory "$APP_DIR"

git -C "$APP_DIR" pull --ff-only
"$APP_DIR/backend/venv/bin/pip" install -q -r "$APP_DIR/backend/requirements.txt"
(cd "$APP_DIR/frontend" && npm ci --no-audit --no-fund && VITE_API_BASE= npm run build)
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

systemctl restart cryptobot
# Конфіг Caddy міг змінитись у репозиторії — переносимо, зберігши домен.
SITE_HOST=$(awk '/^[a-zA-Z0-9.-]+ \{$/{print $1; exit}' /etc/caddy/Caddyfile)
if [[ -n "$SITE_HOST" ]]; then
	sed "s|^SITE_HOST {|$SITE_HOST {|" "$APP_DIR/deploy/Caddyfile" > /etc/caddy/Caddyfile
	caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
	systemctl reload caddy
fi

sleep 3
curl -sf http://127.0.0.1:8000/health && echo || { echo "УВАГА: /health не відповідає"; journalctl -u cryptobot -n 30 --no-pager; exit 1; }
