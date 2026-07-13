# Розгортання (Завдання 26)

Рекомендована безкоштовна зв'язка: **Render** (backend) + **Vercel** (frontend) + **Neon** (PostgreSQL).

## 1. База даних — Neon

1. Створіть проєкт на https://neon.tech
2. Скопіюйте connection string і приведіть до формату asyncpg:
   `postgresql+asyncpg://user:password@host/dbname`
3. Це значення піде в `DATABASE_URL` на Render.

## 2. Backend — Render

1. Запуште репозиторій на GitHub.
2. Render -> New -> Web Service -> вкажіть репозиторій (файл `render.yaml` у корені підхопиться автоматично) або вручну:
   - Root directory: `backend`
   - Build: `pip install -r requirements.txt` (розкоментуйте `asyncpg` у requirements.txt!)
   - Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Environment variables:
   - `DATABASE_URL` — з Neon
   - `JWT_SECRET` — довгий випадковий рядок
   - `CORS_ORIGINS` — URL frontend, напр. `https://your-app.vercel.app`
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — з `python scripts/generate_vapid.py`
4. Health check path: `/health` — Render сам перезапустить сервіс при падінні
   (автоматичний перезапуск із Завдання 27).

## 3. Frontend — Vercel

1. Vercel -> Add New Project -> той самий репозиторій.
2. Root directory: `frontend`. Framework: Vite (визначиться сам).
3. Environment variable: `VITE_API_BASE=https://your-backend.onrender.com`
4. `vercel.json` уже містить SPA-rewrite (усі маршрути -> index.html),
   інакше пряме відкриття `/analyze/BTCUSDT` давало б 404.

## 4. Перевірка після розгортання

- `https://your-backend.onrender.com/health` -> `"status": "online"`, біржа та БД `connected`
- Відкрийте frontend -> ціни оновлюються (WebSocket іде через `wss://`)
- Safari на iPhone -> Share -> Add to Home Screen -> застосунок відкривається без панелі браузера
- Увійдіть -> Alerts -> Enable push -> створіть сповіщення з умовою, що от-от спрацює

## Нотатки

- **HTTPS обов'язковий** для PWA-встановлення і push — Render/Vercel дають його з коробки.
- Free-тарифи Render присипляють сервіс без трафіку; фонові сервіси (запис сигналів)
  зупиняються разом із ним. Для безперервного запису — платний тариф або Fly.io/VPS.
- На VPS автоперезапуск: systemd-юніт із `Restart=always` (приклад у коментарі render.yaml).
