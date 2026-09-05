#!/usr/bin/env bash
#
# Бекап SQLite. Через cron раз на добу:
#   sudo crontab -e
#   0 3 * * * /opt/crypto-market-bot/deploy/backup-db.sh
#
# Копіюємо через .backup, а не cp: застосунок пише в базу постійно, і проста
# копія файла під час запису дає пошкоджений знімок.

set -euo pipefail

DB=/opt/crypto-market-bot/backend/crypto_bot.db
DEST=/var/backups/crypto-market-bot
KEEP_DAYS=14

mkdir -p "$DEST"
sqlite3 "$DB" ".backup '$DEST/crypto_bot-$(date +%F).db'"
gzip -f "$DEST/crypto_bot-$(date +%F).db"
find "$DEST" -name 'crypto_bot-*.db.gz' -mtime +"$KEEP_DAYS" -delete
