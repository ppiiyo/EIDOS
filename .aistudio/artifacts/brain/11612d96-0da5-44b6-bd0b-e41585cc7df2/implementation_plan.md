# План финальной доводки и релиза EIDOS v3.2 GA (Production Release Polish)

## 1. Архитектурная зачистка и дедупликация репозитория (Repo Hygiene)
- **Консолидация фронтенда в `apps/workspace`:**
  - Проверить уникальные утилиты и компоненты в `apps/studio`, перенести всё полезное в единый фронтенд `apps/workspace` и удалить дублирующую директорию `apps/studio`.
  - Обновить `package.json` (workspaces, скрипты сборки и запуска), чтобы проект имел единую прозрачную точку входа.
- **Дедупликация тестов и синхронизация версий `v3.2.0`:**
  - Удалить дублирующийся тест `packages/core/tests/clip-embedder.test.ts` (оставив каноничную версию в `packages/core/src/tests/clip-embedder.test.ts`).
  - Синхронизировать версию `3.2.0` во всех `package.json` монорепозитория и сформировать актуальный `RELEASE_NOTES_v3.2.md`.

## 2. Апгрейд Пользовательского Опыта (UX / Developer Experience в `apps/workspace`)
- **Интерактивная панель Cluster Topology & Chaos/Failover Inspector:**
  - Визуализация кольца консистентного хэширования (`ConsistentHashRing`) и статуса шардов (`/v1/cluster/status`: `leader`, `replica`, `healthy`, `degraded`, `draining`, `offline`).
  - Управление отказоустойчивостью прямо из UI: кнопки симуляции деградации шарда (`/v1/cluster/shards/:shardId/health`) и бесшовного вывода ноды (`POST /v1/cluster/drain`) с наглядным отображением автоматического переключения лидера (Leader Failover) без потери данных.
- **1-Click Custom JSON Catalog Importer & Multi-Language SDK Code Generator:**
  - Модальное окно / панель быстрого импорта пользовательского JSON-каталога (плюс готовые пресеты: *Electronics*, *Fashion*, *SaaS Docs*) напрямую через `POST /v1/catalog/upsert` с мгновенным обновлением поисковой выдачи.
  - Интерактивный генератор кода (**TypeScript SDK**, **Python SDK**, **cURL**), который динамически подставляет текущие выбранные пользователем параметры поиска (поисковый запрос, режим `hybrid`/`dense`/`sparse`, `mmrLambda`, фильтры и веса бустинга) для копирования в 1 клик.

## 3. Стабилизация SLA-бенчмарков и 100% зелёный CI
- **Устранение CPU-contention флака в `tests/benchmarks/search-sla.test.ts`:**
  - Добавить предварительный прогрев JIT/кэша (warmup iterations) и стабилизацию замеров перцентилей при многопоточном запуске Vitest, чтобы исключить ложные срабатывания из-за конкуренции 86 тестовых воркеров за CPU.
  - Проверить прохождение всего тестового контура (`vitest run`) и сборки (`compile_applet`).
