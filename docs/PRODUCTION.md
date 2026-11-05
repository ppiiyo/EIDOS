# EIDOS v3.4.0-pilot — Production & 15-Minute Pilot Runbook

> **Статус релиза**: **`v3.4.0-pilot` (Pilot-Ready)**. Предназначен для коммерческих пилотов на self-hosted инфраструктуре (Docker / Node.js 20+) для каталогов от 500 до 50 000 SKU с коннекторами **1С-Битрикс**, **WooCommerce** или прямым импортом **CSV / JSON / YML**. Не позиционируется как managed cloud SLA из коробки.

---

## ⚡ Pilot in 15 Minutes (Быстрый запуск пилота для магазина или агентства)

### Шаг 1. Поднять self-hosted EIDOS (2 минуты)
```bash
# Вариант А: Однокомандный скрипт пилота (генерирует ключи MASTER_KEY, ADMIN_KEY, SEARCH_KEY и ждёт GET /v1/ready == 200)
bash scripts/install-pilot.sh

# Вариант Б: Docker Compose напрямую
cp .env.example .env
docker compose up --build -d
curl -fsS http://localhost:3000/v1/ready
```

### Шаг 2. Загрузить каталог и подключить витрину (8 минут)
Выберите один из трёх сценариев под стек клиента:
1. **WooCommerce (`packages/connectors/woocommerce`)**:
   - Упакуйте `packages/connectors/woocommerce` в `eidos-woocommerce.zip`, загрузите в **Плагины → Добавить новый → Загрузить плагин** и активируйте.
   - В **Настройки → EIDOS Search** укажите URL EIDOS, `EIDOS_ADMIN_KEY` и `EIDOS_SEARCH_KEY`.
   - Нажмите **«Проверить связь»**, затем **«Синхронизировать»** (см. [`docs/integrations/woocommerce.md`](./integrations/woocommerce.md)).
2. **1С-Битрикс (`packages/connectors/bitrix`)**:
   - Настройте `EIDOS_ADMIN_KEY` (для выгрузки `ELEMENT_ID` + `XML_ID -> sku`) и `EIDOS_SEARCH_KEY` (для поиска `/v1/search` с fallback на `CIBlockElement::GetList`).
   - Запустите первичную синхронизацию (см. [`docs/integrations/bitrix.md`](./integrations/bitrix.md)).
3. **Универсальный CSV / JSON / YML путь (без CMS-плагина)**:
   - Загрузите прайс-лист через `POST /v1/catalog/upsert` с заголовком `X-API-Key: $EIDOS_ADMIN_KEY` (см. [`docs/CSV_CONTRACT.md`](./CSV_CONTRACT.md)) или через мастер в Studio UI.

### Шаг 3. Проверить 3 контрольных запроса приёмки (5 минут)
Выполните запросы к `POST /v1/search` с ключом чтения **`EIDOS_SEARCH_KEY`**:
1. **Многосоставной запрос с категорией и модификатором** (`"недорогие наушники для бега"`, `simpleCategoryGate: "hard"`):
   - Ожидание: все товары в `top-3` принадлежат категории `Наушники` (никаких беговых кроссовок), `scorePercent` в диапазоне `60..99%`, заполнено `humanExplanation`.
2. **Мусорный / нерелевантный запрос** (`"xyzabcqqq999"`):
   - Ожидание: `count: 0`, `results: []` (отсутствие ложных совпадений со `score ~0.016`).
3. **Проверка управления весами (`alpha: 0` vs `alpha: 1`)**:
   - Ожидание: ответ содержит применённые `alpha` и `weights`, переключение между чистой лексикой (`alpha: 0`) и семантикой (`alpha: 1`) меняет ранжирование и компоненты `explanation` (`denseComponent` vs `sparseBm25Component`).

---

## 1. Обязательные переменные окружения (`NODE_ENV=production`)

При запуске с `NODE_ENV=production` и `EIDOS_STRICT_PROD_BOOT=true` сервер **откажется стартовать** (`process.exit(1)`), если не задан криптографически стойкий мастер-ключ или в ключах остались дефолтные значения (`change_me`, `dev-secret`).

Создайте `.env` на основе `.env.example`:

```bash
NODE_ENV=production
PORT=3000
EIDOS_STRICT_PROD_BOOT=true

# 1. Иерархия ключей доступа (минимум 16 символов для каждого ключа)
EIDOS_MASTER_KEY=eidos_master_prod_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c
EIDOS_ADMIN_KEY=eidos_admin_prod_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d
EIDOS_SEARCH_KEY=eidos_search_prod_7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c

# 2. CORS (укажите точные домены витрины и студии через запятую)
CORS_ORIGIN=https://shop.example.com,https://search-studio.example.com

# 3. Redis для распределённого кэша поисковых запросов
REDIS_URL=redis://redis:6379

# 4. Персистентность индекса (Snapshots)
EIDOS_SNAPSHOT_PATH=/var/lib/eidos/snapshots
EIDOS_SNAPSHOT_INTERVAL_MS=300000
EIDOS_AUTO_RESTORE_SNAPSHOT=true

# 5. Ограничение частоты запросов (Rate Limiting)
EIDOS_RATE_LIMIT_MAX=600
EIDOS_RATE_LIMIT_WINDOW=1 minute
```

### Роли ключей (`SEARCH_KEY` vs `ADMIN_KEY`)
| Ключ | Назначение | Разрешённые эндпоинты |
| :--- | :--- | :--- |
| `EIDOS_MASTER_KEY` | Управление и ротация ключей (`/v1/keys/*`). Никогда не передавайте на фронтенд. | Полный доступ + `/v1/keys` |
| `EIDOS_ADMIN_KEY` | Загрузка и очистка каталога, управление синонимами/правилами, снапшоты, аналитика. | `/v1/catalog/*`, `/v1/merchandising/*`, `/v1/snapshots/*`, `/v1/analytics/*` |
| `EIDOS_SEARCH_KEY` | Ключ чтения для витрины магазина (WooCommerce / 1С-Битрикс / мобильное приложение). | Только чтение и телеметрия: `/v1/search`, `/v1/recommend`, `/v1/feedback` |

---

## 2. Reverse Proxy и HTTPS

Не публикуйте внутренний контейнер напрямую без TLS. Используйте Nginx или Caddy перед контейнером `api`:

- Готовые конфигурации находятся в репозитории:
  - `deploy/Caddyfile` (автоматический Let's Encrypt TLS)
  - `deploy/nginx.conf` (TLS termination, gzip, proxy buffering)
- Лимит тела запроса (`bodyLimit`) в API установлен в **10 MB** для пакетных JSON/CSV-выгрузок (`/v1/catalog/upsert`). Убедитесь, что в Nginx задано `client_max_body_size 10m;`.

---

## 3. Health, Readiness и Мониторинг

Для Docker Healthcheck, Kubernetes probes и диагностики из плагинов Битрикс / WooCommerce используйте:

| Эндпоинт | Назначение | Критерий `200 OK` |
| :--- | :--- | :--- |
| `GET /v1/health/live` | Liveness probe | Процесс Node.js жив и отвечает на HTTP |
| `GET /v1/health` | Общий статус и версия (`3.4.0`) | Возвращает статус, аптайм, `itemsIndexed` и использование памяти |
| `GET /v1/ready` | Readiness probe | Движок инициализирован, HNSW + BM25 индекс готов обслуживать запросы |
| `GET /metrics` | Метрики Prometheus | Гистограммы латентности `p50/p95/p99`, счётчики ошибок, размер индекса и кэша |

---

## 4. Персистентность, Снапшоты и Бэкапы

Поисковый движок EIDOS хранит граф HNSW (`Float32Array 384-d`) и инвертированный индекс BM25 **в оперативной памяти (in-memory)**.

Чтобы данные не терялись при рестарте контейнера:
1. Смонтируйте Docker volume в директорию `EIDOS_SNAPSHOT_PATH` (в `docker-compose.prod.yml` это volume `eidos_data:/app/data`).
2. При каждом `POST /v1/catalog/upsert` и по таймеру `EIDOS_SNAPSHOT_INTERVAL_MS` движок атомарно сохраняет снапшот на диск.
3. При старте контейнера с `EIDOS_AUTO_RESTORE_SNAPSHOT=true` последний валидный снапшот автоматически загружается в память.
4. Принудительное создание снапшота перед обновлением релиза:
   ```bash
   curl -X POST http://localhost:3000/v1/snapshots \
     -H "Authorization: Bearer $EIDOS_ADMIN_KEY"
   ```

---

## 5. Оценка ресурсов (RAM / CPU) и Замеры производительности Single-Node

| Объём каталога | Рекомендуемый RAM | Рекомендуемый vCPU | Время холодного старта (из снапшота) |
| :--- | :--- | :--- | :--- |
| **До 1 000 SKU** (малый магазин / пилот) | 512 MB – 1 GB | 0.5 – 1 vCPU | < 1 сек |
| **10 000 SKU** (средний e-com пилот) | 2 GB – 4 GB | 2 vCPU | ~2–4 сек |
| **50 000 SKU** (крупный каталог) | 8 GB | 4 vCPU | ~10–15 сек |

---

## 6. Чек-лист перед запуском пилота (`v3.4.0-pilot`)

- [ ] В `.env` заданы уникальные `EIDOS_MASTER_KEY`, `EIDOS_ADMIN_KEY`, `EIDOS_SEARCH_KEY` и `EIDOS_STRICT_PROD_BOOT=true`.
- [ ] Проверен `GET /v1/ready` — возвращает `200 OK` и `"ready": true`.
- [ ] Каталог загружен через `POST /v1/catalog/upsert` (CSV, 1С-Битрикс или WooCommerce) с проверкой `rowErrors: []`.
- [ ] Проверено разделение прав: запрос с `EIDOS_SEARCH_KEY` к `POST /v1/search` возвращает `200 OK`, а к `POST /v1/catalog/upsert` — `403 Forbidden`.
- [ ] Проверены 15 золотых запросов пилота (включая многосоставные запросы с `simpleCategoryGate: "hard"` и мусорные запросы → `count: 0`).
- [ ] Проверен аварийный fallback коннектора (при остановке EIDOS витрина WooCommerce / 1С-Битрикс автоматически переключается на штатный поиск CMS без ошибки 500).
- [ ] Настроен persistent volume для `EIDOS_SNAPSHOT_PATH`.

---

## 7. Регламент «Пилот 14 дней» (Runbook приёмки на каталоге клиента)

| Этап | Срок | Действия | Артефакт / проверка |
| :--- | :--- | :--- | :--- |
| **1. Инфраструктура** | День 1 | Развёртывание Docker (`bash scripts/install-pilot.sh`), настройка TLS, выпуск `ADMIN_KEY` и `SEARCH_KEY` | `GET /v1/ready` → `200 OK` |
| **2. Индексация каталога** | День 1–2 | Подключение коннектора **WooCommerce**, **1С-Битрикс** или пакетный `POST /v1/catalog/upsert` (CSV/YML) | `itemsIndexed == размер прайса`, `rowErrors: []` |
| **3. Матрица Golden Queries** | Дни 3–12 | Составление 15–20 реальных запросов магазина (категорийные с модификаторами, бренды/артикулы, опечатки, синонимы через `/admin`) | Таблица `PASS / FAIL` по каждому запросу |
| **4. Приёмка (Go / No-Go)** | День 14 | Финальный замер качества и отказоустойчивости | **≥ 80% top-3 релевантны**, мусор → `count: 0`, штатный fallback CMS при остановке контейнера EIDOS |

