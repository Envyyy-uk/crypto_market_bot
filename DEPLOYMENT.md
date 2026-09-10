# Розгортання (Завдання 26)

Два перевірені шляхи:

* **[Власний VPS (Hetzner) — один сервер, один домен](#варіант-a-власний-vps-hetzner)** — фронтенд і API за одним Caddy. Скрипти в `deploy/`.
* **[Render + Vercel + Neon](#варіант-b-render--vercel--neon)** — без свого сервера, але free-тариф Render присипляє фонові сервіси.

---

## Варіант A: власний VPS (Hetzner)

### Що обрати

**Сервер.** CAX11 (ARM, 2 vCPU / 4 ГБ) з надлишком покриває навантаження: 54 пари
в одному WebSocket-з'єднанні, індикатори на pandas і бек-тест на 1000 свічках.
Менше 1 ГБ RAM брати не варто — сам pandas займає близько 100 МБ.

**Локація — Німеччина або Фінляндія, не США.** Це не смаківщина: Bybit
блокує американські IP, а `api.binance.com` віддає 451 із США (саме тому в
коді дефолтом стоїть Binance.US — його обрали під Render, що хоститься в
США). `deploy/setup.sh` перевіряє обидва дзеркала запитом і записує в `.env`
те, яке реально відповідає з вашого сервера.

**ОС.** Ubuntu 24.04 LTS — під неї написані скрипти.

**Домен.** Обов'язковий, і саме домен, а не IP: на голий IP не видають TLS-
сертифікат, а без HTTPS не встановлюється PWA і не працює Web Push. Якщо
свого домену немає — безкоштовний піддомен на [duckdns.org](https://www.duckdns.org):
створюєте `щось.duckdns.org` і вписуєте IP сервера. IP у VPS статичний, тож
жодного оновлювача адреси не потрібно.

### Порядок дій

1. Створіть сервер у Hetzner Cloud (CAX11, Ubuntu 24.04, ваш SSH-ключ).
2. Спрямуйте домен A-записом на IP сервера. Перевірте, що записався:
   `dig +short bot.example.duckdns.org`
3. Зайдіть по SSH і запустіть:

   ```bash
   git clone https://github.com/Envyyy-uk/crypto_market_bot /tmp/cmb
   sudo bash /tmp/cmb/deploy/setup.sh bot.example.duckdns.org
   ```

   **Розгортання не з гілки за замовчуванням** потребує двох змін, а не
   однієї: гілку треба вказати і при клонуванні (інакше в `/tmp/cmb` не
   буде самої теки `deploy/`), і третім аргументом скрипта (він визначає,
   що саме розгортається на сервер):

   ```bash
   git clone -b НАЗВА-ГІЛКИ https://github.com/Envyyy-uk/crypto_market_bot /tmp/cmb
   sudo bash /tmp/cmb/deploy/setup.sh bot.example.duckdns.org "" НАЗВА-ГІЛКИ
   ```

Скрипт ставить пакети, створює системного користувача `cryptobot`, збирає
venv і фронтенд, генерує `JWT_SECRET` і VAPID-ключі, вмикає systemd-юніт,
налаштовує Caddy і фаєрвол. Сертифікат Caddy отримає сам при першому запиті.

4. Бекап бази — один рядок у cron (`sudo crontab -e`):

   ```
   0 3 * * * /opt/crypto-market-bot/deploy/backup-db.sh
   ```

### Перевірка

```bash
curl https://bot.example.duckdns.org/health
# {"status":"online","exchangeConnection":"connected","database":"connected",...}
```

Далі відкрийте сайт: ціни мають оновлюватися без перезавантаження, а бейдж
у шапці показувати зелене **Connected**. Якщо там бурштинове **No market
data** — застосунок живий, але не достукався до біржі (дивіться
`journalctl -u cryptobot -f`).

На iPhone: Safari → Share → Add to Home Screen. Push вимагає iOS 16.4+ і
працює лише для встановленої на домашній екран PWA.

### Оновлення

```bash
sudo bash /opt/crypto-market-bot/deploy/update.sh
```

Підтягує код, перезбирає фронтенд, перезапускає сервіс і перевіряє `/health`.
`.env` не чіпається — секрети переживають оновлення.

### Що всередині `deploy/`

| Файл | Призначення |
|---|---|
| `setup.sh` | Розгортання з нуля на чистому Ubuntu 24.04 |
| `update.sh` | Оновлення вже розгорнутого сервера |
| `backup-db.sh` | Бекап SQLite через `.backup` (не `cp`) з ротацією 14 днів |
| `Caddyfile` | Один домен: статика + проксі `/api`, `/ws`, `/health`, `/docs` |
| `cryptobot.service` | systemd: автозапуск, `Restart=always`, пісочниця |
| `cryptobot.logrotate` | Ротація `app.log` — інакше він росте без обмежень |

### Дві пастки, на які варто зважати

**Порядок директив у Caddy.** У `Caddyfile` бекенд і статика розведені по
взаємовиключних блоках `handle` — і це принципово. Caddy виконує директиви у
своєму фіксованому порядку, а не в порядку рядків файлу, і `try_files` (клас
`rewrite`) спрацьовує раніше за `reverse_proxy`. Якщо написати їх поруч без
`handle`, шлях `/ws/markets` встигне перетворитись на `/index.html`, матчер
бекенду вже не збіжиться — і WebSocket мовчки отримає HTML замість upgrade.
Сторінка при цьому відкривається нормально, просто ціни не йдуть.

**Порожній `VITE_API_BASE`.** Фронтенд збирається командою
`VITE_API_BASE= npm run build`. Порожнє значення означає «той самий origin»:
запити йдуть відносними шляхами `/api/...`. Прибрати змінну зовсім не можна —
тоді збірка візьме дефолт `http://localhost:8000` і на сервері не працюватиме
нічого. Адресу WebSocket `src/config.ts` у цьому режимі збирає з
`window.location`, бо `WebSocket`, на відміну від `fetch`, відносних шляхів не
приймає.

---

## Варіант B: Render + Vercel + Neon

Безкоштовна зв'язка: **Render** (backend) + **Vercel** (frontend) + **Neon** (PostgreSQL).

### 1. База даних — Neon

1. Створіть проєкт на https://neon.tech
2. Скопіюйте connection string і приведіть до формату asyncpg:
   `postgresql+asyncpg://user:password@host/dbname`
3. Це значення піде в `DATABASE_URL` на Render.

### 2. Backend — Render

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

### 3. Frontend — Vercel

1. Vercel -> Add New Project -> той самий репозиторій.
2. Root directory: `frontend`. Framework: Vite (визначиться сам).
3. Environment variable: `VITE_API_BASE=https://your-backend.onrender.com`
4. `vercel.json` уже містить SPA-rewrite (усі маршрути -> index.html),
   інакше пряме відкриття `/analyze/BTCUSDT` давало б 404.

### 4. Перевірка після розгортання

- `https://your-backend.onrender.com/health` -> `"status": "online"`, біржа та БД `connected`
- Відкрийте frontend -> ціни оновлюються (WebSocket іде через `wss://`)
- Safari на iPhone -> Share -> Add to Home Screen -> застосунок відкривається без панелі браузера
- Увійдіть -> Alerts -> Enable push -> створіть сповіщення з умовою, що от-от спрацює

### Нотатки

- **HTTPS обов'язковий** для PWA-встановлення і push — Render/Vercel дають його з коробки.
- Free-тарифи Render присипляють сервіс без трафіку; фонові сервіси (запис сигналів)
  зупиняються разом із ним. Для безперервного запису — платний тариф або Fly.io/VPS.
- На VPS автоперезапуск: systemd-юніт із `Restart=always` (приклад у коментарі render.yaml).
