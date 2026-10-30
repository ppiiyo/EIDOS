# EIDOS v3.4.0 — Production Runbook & Checklist

Этот документ описывает минимальный операционный контур для запуска **EIDOS v3.4.0** в 7–14-дневном коммерческом пилоте или self-hosted production-окружении.

---

## 1. Обязательные переменные окружения (`NODE_ENV=production`)

При запуске с `NODE_ENV=production` и `EIDOS_STRICT_PROD_BOOT=true` сервер **откажется стартовать** (`process.exit(1)`), если не задан криптографически стойкий мастер-ключ или в ключах остались дефолтные значения (`change_me`, `dev-secret`).

Создайте `.env` на основе `.env.example`:

```bash
NODE_ENV=production
PORT=3001
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

### Роли ключей
| Ключ | Назначение | Разрешённые эндпоинты |
| :--- | :--- | :--- |
| `EIDOS_MASTER_KEY` | Управление и ротация ключей (`/v1/keys/*`). Никогда не передавайте на фронтенд. | Полный доступ + `/v1/keys` |
| `EIDOS_ADMIN_KEY` | Загрузка каталога, управление синонимами/правилами, снапшоты, аналитика. | `/v1/catalog/*`, `/v1/merchandising/*`, `/v1/snapshots/*`, `/v1/analytics/*` |
| `EIDOS_SEARCH_KEY` | Публичный ключ для витрины магазина / мобильного приложения. | Только чтение: `/v1/search`, `/v1/recommend`, `/v1/suggest` |

---

## 2. Reverse Proxy и HTTPS

Не публикуйте порт `3001` напрямую в интернет. Используйте Nginx или Caddy перед контейнером `api`:

- Готовые конфигурации находятся в репозитории:
  - `deploy/Caddyfile` (автоматический Let's Encrypt TLS)
  - `deploy/nginx.conf` (TLS termination, gzip, proxy buffering)
- Лимит тела запроса (`bodyLimit`) в API установлен в **10 MB** для пакетных JSON/CSV-выгрузок (`/v1/catalog/upsert`). Убедитесь, что в Nginx задано `client_max_body_size 10m;`.

---

## 3. Health, Readiness и Мониторинг

Для Docker Healthcheck, Kubernetes probes и внешнего аптайм-мониторинга используйте:

| Эндпоинт | Назначение | Критерий `200 OK` |
| :--- | :--- | :--- |
| `GET /v1/health/live` | Liveness probe | Процесс Node.js жив и отвечает на HTTP |
| `GET /v1/health` | Общий статус и версия (`3.4.0`) | Возвращает статус, аптайм, размер каталога и использование памяти |
| `GET /v1/ready` | Readiness probe | Движок инициализирован, HNSW + BM25 индекс готов обслуживать запросы |
| `GET /metrics` | Метрики Prometheus | Гистограммы латентности `p50/p95/p99`, счётчики ошибок, размер индекса и кэша |

Пример проверки готовности:
```bash
curl -fsS http://localhost:3001/v1/ready
```

---

## 4. Персистентность, Снапшоты и Бэкапы

Поисковый движок EIDOS хранит граф HNSW (Float32Array 384-d) и инвертированный индекс BM25 **в оперативной памяти (in-memory)** для обеспечения суб-15 мс латентности.

Чтобы данные не терялись при рестарте контейнера:
1. Смонтируйте Docker volume в директорию `EIDOS_SNAPSHOT_PATH` (в `docker-compose.prod.yml` это volume `eidos_data:/app/data`).
2. При каждом `POST /v1/catalog/upsert` и по таймеру `EIDOS_SNAPSHOT_INTERVAL_MS` движок сохраняет снапшот на диск с контрольной суммой **SHA-256**.
3. При старте контейнера с `EIDOS_AUTO_RESTORE_SNAPSHOT=true` последний валидный снапшот автоматически загружается в память.
4. Принудительное создание снапшота перед обновлением релиза:
   ```bash
   curl -X POST http://localhost:3001/v1/snapshots \
     -H "Authorization: Bearer $EIDOS_ADMIN_KEY"
   ```
5. **Рекомендация для production**: помимо снапшотов храните исходный каталог в вашей основной БД (PostgreSQL / 1С-Битрикс / МойСклад) или в S3-бакете, чтобы в любой момент можно было пересобрать индекс с нуля через `POST /v1/catalog/upsert`.

---

## 5. Оценка ресурсов (RAM / CPU) и Замеры производительности

> **Примечание**: Ниже приведены расчётные оценки потребления памяти для 384-мерных векторов `Float32` + графа HNSW (`M=16`, `efConstruction=200`) + инвертированного индекса BM25 в одном процессе Node.js:

| Объём каталога | Рекомендуемый RAM | Рекомендуемый vCPU | Время холодного старта (из снапшота) |
| :--- | :--- | :--- | :--- |
| **До 1 000 SKU** (демо / малый магазин) | 512 MB – 1 GB | 0.5 – 1 vCPU | < 1 сек |
| **10 000 SKU** (средний e-com пилот) | 2 GB – 4 GB | 2 vCPU | ~2–4 сек |
| **50 000 SKU** (крупный каталог) | 8 GB | 4 vCPU | ~10–15 сек |

### Реальные замеры In-Memory ядра (Node.js v20, 1 worker, HNSW 384-d + BM25 + RRF)

Замеры выполнены на встроенном бенчмарке ядра (`packages/core` / `/v1/search`) без сетевого RTT:

| Размер индекса | `p50` Search Latency | `p95` Search Latency | `p99` Search Latency | Индексация батча |
| :--- | :--- | :--- | :--- | :--- |
| **48 SKU** (эталонный демо-каталог) | `0.8 ms` | `2.1 ms` | `3.4 ms` | `~18 ms` (48 SKU) |
| **10 000 SKU** (синтетический e-com каталог) | `4.2 ms` | `11.8 ms` | `18.5 ms` | `~1.9 s` (10k SKU) |

---

## 6. Чек-лист перед запуском пилота

- [ ] В `.env` заданы уникальные `EIDOS_MASTER_KEY`, `EIDOS_ADMIN_KEY`, `EIDOS_SEARCH_KEY` и `EIDOS_STRICT_PROD_BOOT=true`.
- [ ] Проверен `GET /v1/ready` — возвращает `200 OK` и `"ready": true`.
- [ ] Каталог загружен через `POST /v1/catalog/upsert` или CSV-импорт (см. [`docs/CSV_CONTRACT.md`](./CSV_CONTRACT.md)).
- [ ] Проверен тестовый запрос с витрины с использованием `EIDOS_SEARCH_KEY` (ключ чтения не должен позволять вызывать `/v1/catalog/upsert`).
- [ ] Настроен persistent volume для `EIDOS_SNAPSHOT_PATH` и проверено восстановление индекса после `docker compose restart api`.
