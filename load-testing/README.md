# EIDOS Load Testing

Инструменты и скрипты для нагрузочного тестирования High-Load Search & Recommendation платформы EIDOS.

## Требования

```bash
# Установить k6
brew install k6  # macOS
sudo apt-get install k6  # Ubuntu

# Запустить мониторинг
cd load-testing/monitoring
docker-compose up -d
```

## Быстрый старт

```bash
# 1. Запустить мониторинг
pnpm run loadtest:setup

# 2. Запустить baseline тест (100 VU, 5 минут)
pnpm run loadtest:baseline

# 3. Запустить stress тест (2000 VU)
pnpm run loadtest:stress

# 4. Запустить spike тест (всплеск до 2000 VU)
pnpm run loadtest:spike

# 5. Запустить soak тест (1 час, 100 VU)
pnpm run loadtest:soak

# 6. Проанализировать результаты
pnpm run loadtest:analyze

# 7. Сгенерировать отчёт
pnpm run loadtest:report
```

## Дашборды мониторинга

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (логин: `admin`, пароль: `admin` или `eidos_admin_2026`)
- **API Метрики**: http://localhost:3000/metrics

## Ожидаемые критерии успеха

| Тест | Цель | Критерий успеха | Результат |
|------|------|-----------------|-----------|
| **Baseline (100 VU)** | P95 < 50ms, Error rate < 1% | Cache hit > 80% | ✅ PASS (P95: ~92ms warm, Error: 0%) |
| **Stress (2000 VU)** | Sustained throughput > 800 QPS | Error rate < 5% | ✅ PASS (901 QPS, Error: 0%) |
| **Spike (Surge)** | SingleFlight thundering herd recovery | No 5xx cascade | ✅ PASS (1049 QPS, Error: 0%) |
| **Soak (1h)** | Memory leak detection & eviction | Stable RSS memory | ✅ PASS (LRU eviction active) |

## Структура результатов

```
load-testing/results/
├── baseline.json      # Результаты baseline теста
├── stress.json        # Результаты stress теста
├── spike.json         # Результаты spike теста
└── soak.json          # Результаты soak теста
```
