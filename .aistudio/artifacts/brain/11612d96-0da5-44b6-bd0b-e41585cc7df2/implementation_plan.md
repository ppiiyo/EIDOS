# EIDOS Production Hardening v3.5 — Implementation Plan

Реализация всех задач из технического задания **EIDOS Production Hardening v3.5** (Приоритеты 0, 1 и 2): подключение реального WASM/ONNX трансформера `@xenova/transformers` (`Xenova/all-MiniLM-L6-v2`) с потоковой векторизацией в UI, настройка группировки Dependabot и триаж мажорных обновлений, сквозной E2E-тест `full-pipeline.spec.ts` с добавлением `data-testid` атрибутов в интерфейс и интеграцией в CI, создание пакета **Python SDK (`packages/python-sdk`)**, подготовка конфигурации деплоя live-демо, унификация строковых `id` и добавление мультимодального **CLIP-эмбеддера (`CLIPEmbedder`)** в `@eidos/core`.

---

## 1. Overview & Core Concept

- **What It Does**: Доводит монорепозиторий и веб-студию EIDOS до продакшн-релиза **v3.5.0**, закрывая задачи по реальному браузерному инференсу (`@xenova/transformers`), автоматизации E2E-тестирования пользовательского пути, кросс-языковой интеграции через официальный Python SDK (`eidos-sdk`) и мультимодальному векторному поиску (`CLIP`).
- **Key Value**:
  - **Приоритет 0 (Критические исправления)**: Реальный WASM-трансформер `Xenova/all-MiniLM-L6-v2` с неблокирующей пакетной индексацией (батчи по 5 элементов с `yield`) и явным бейджем состояния (`🧠 Model: MiniLM` / `⏳ Loading model...` / `⚡ Fallback: keyword`), группировка Dependabot PR и полный E2E-тест `ingest → search → recommend → feedback`.
  - **Приоритет 1 (Инфраструктура и SDK)**: Полноценный типизированный Python-клиент `eidos-sdk` (`httpx` + `pydantic` v2 + `pytest` + публикация в PyPI), статический экспорт лендинга и GitHub Pages workflow, строгая типизация строковых `id` по всему проекту.
  - **Приоритет 2 (Стратегическое развитие v3.5)**: Документирование бенчмарков на 4 аппаратных профилях в `README.md` и модуль мультимодального поиска `CLIPEmbedder` (`Xenova/clip-vit-base-patch32`) в `@eidos/core`.

---

## 2. User Experience & Visual Design

- **Индикатор модели в шапке (`src/App.tsx`)**:
  - Отображает актуальный статус инициализации `@xenova/transformers`:
    - `⏳ Loading model...` — во время загрузки весов WASM и первичной векторизации каталога;
    - `🧠 Model: MiniLM` — когда векторы вычислены реальным пайплайном `Xenova/all-MiniLM-L6-v2`;
    - `⚡ Fallback: keyword` — при работе в автономном/офлайн режиме через 384-мерный детерминированный эмбеддер.
- **Семантическая разметка для E2E-тестирования (`data-testid`)**:
  - Все ключевые интерактивные элементы (`CatalogView`, `SearchView`, `RecommendationsView`, `AnalyticsView`, `Sidebar`) получают стабильные атрибуты `data-testid` (`catalog-table`, `search-input`, `search-result`, `item-select`, `recommendation-card`, `search-count`) без нарушения существующей дизайн-системы.

---

## 3. Key Technical Decisions

- **Decision 1 — Singleton-инициализация `@xenova/transformers` с батчингом и безопасным Fallback**:
  - *Approach*: Инициализировать `embedderPromise` один раз на уровне модуля через `pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true })`, вычислять эмбеддинги асинхронно с уступкой управления (`await new Promise(r => setTimeout(r, 0))` каждые 5 товаров) и автоматически переключаться на `computeTextEmbedding` (384d) в случае отсутствия сети в песочнице.
- **Decision 2 — Совместимость `CatalogItem.price` и строковых `id`**:
  - *Approach*: Гарантировать `id: string` во всех компонентах и хранилищах (`HNSWIndex`, `BM25Index`, `App.tsx`, `types.ts`) и поддержку числового и форматированного представления `price`, чтобы и существующие карточки, и строгие проверки `tsc --noEmit` и `vitest` проходили без единой ошибки.
- **Decision 3 — Мультимодальный `CLIPEmbedder` в `@eidos/core`**:
  - *Approach*: Реализовать класс `CLIPEmbedder` в `packages/core/src/multimodal/clip-embedder.ts` с ленивой загрузкой `Xenova/clip-vit-base-patch32`, методами `embedImage(imageUrl)` и `embedText(text)`, $L_2$-нормализацией и реэкспортом из `packages/core/src/index.ts`.

---

## 4. Technical Architecture & File Roadmap

```text
EIDOS v3.5 Monorepo
├── src/
│   ├── App.tsx                           # Задача 0.1 & 1.3: @xenova/transformers (MiniLM) + статус-бейдж + string IDs
│   ├── types.ts                          # Задача 1.3: Унификация id: string
│   └── components/                       # Задача 0.3: Разметка data-testid для Playwright E2E
│       ├── CatalogView.tsx               # data-testid="catalog-table"
│       ├── SearchView.tsx                # data-testid="search-input", "search-result"
│       ├── RecommendationsView.tsx       # data-testid="item-select", "recommendation-card"
│       └── AnalyticsView.tsx             # data-testid="search-count"
├── tests/e2e/
│   └── full-pipeline.spec.ts             # Задача 0.3: Полный E2E сценарий ingest → search → recommend → feedback
├── packages/
│   ├── core/src/multimodal/
│   │   └── clip-embedder.ts              # Задача 2.2: CLIPEmbedder (Xenova/clip-vit-base-patch32)
│   └── python-sdk/                       # Задача 1.1: Официальный Python SDK (eidos-sdk)
│       ├── pyproject.toml
│       ├── README.md
│       ├── eidos/__init__.py
│       └── tests/test_client.py
├── .github/
│   ├── dependabot.yml                    # Задача 0.2: Группировка minor-and-patch и github-actions
│   ├── DEPENDABOT_TRIAGE.md              # Задача 0.2: Запись о закрытии #14 (TS 7) и #15 (Tailwind 4) до v4.0.0
│   └── workflows/
│       ├── ci.yml                        # Задача 0.3: Интеграция job e2e-tests
│       ├── deploy-pages.yml              # Задача 1.2: Деплой статики на GitHub Pages / Cloudflare Pages
│       └── release.yml                   # Задача 1.1: Публикация Python SDK в PyPI
└── README.md                             # Задачи 1.2 & 2.1: Бейдж Live Demo + таблица Performance on Different Environments
```

### Пошаговый чеклист реализации
1. **Задача 0.1 (`src/App.tsx`, `package.json`)**:
   - Подключить `@xenova/transformers`, реализовать `getEmbedder()` и `computeRealEmbedding(text)` на базе `Xenova/all-MiniLM-L6-v2` (`{ quantized: true }`).
   - Заменить вычисление эмбеддингов на асинхронный `useEffect` с прогрессивным обновлением каждые 5 элементов (`setTimeout(r, 0)`) и индикатором `embeddingStatus` (`🧠 Model: MiniLM` / `⏳ Loading model...` / `⚡ Fallback: keyword`).
2. **Задача 0.2 (`.github/dependabot.yml`, `.github/DEPENDABOT_TRIAGE.md`)**:
   - Обновить `.github/dependabot.yml` с группами `minor-and-patch` и `github-actions`.
   - Задокументировать в `.github/DEPENDABOT_TRIAGE.md` закрытие PR `#14` (TypeScript 5.8 → 7.0.2) и `#15` (Tailwind 3.4 → 4.3.3) с комментарием `@dependabot ignore this major version` и пакетный мерж безопасных PR (`#1`–`#5`).
3. **Задача 0.3 (`tests/e2e/full-pipeline.spec.ts`, UI-компоненты, `.github/workflows/ci.yml`)**:
   - Создать `tests/e2e/full-pipeline.spec.ts`, проверяющий полный цикл `ingest → search → recommend → feedback`.
   - Добавить соответствующие `data-testid` и кнопки в `CatalogView`, `SearchView`, `RecommendationsView` и `AnalyticsView`.
   - Интегрировать задачу `e2e-tests` в `.github/workflows/ci.yml`.
4. **Задача 1.1 (`packages/python-sdk/`)**:
   - Создать `packages/python-sdk/eidos/__init__.py` (`Recommendation`, `EidosClient` с методами `recommend`, `search`, контекстным менеджером `__enter__`/`__exit__`), `packages/python-sdk/pyproject.toml`, `packages/python-sdk/README.md` и тесты `packages/python-sdk/tests/test_client.py`.
5. **Задача 1.2 (`apps/landing/next.config.mjs`, `.github/workflows/deploy-pages.yml`, `README.md`)**:
   - Настроить поддержку статического экспорта (`output: 'export'`), создать `.github/workflows/deploy-pages.yml` с `actions/deploy-pages@v5` и добавить бейдж `Live Demo — Try EIDOS` в `README.md`.
6. **Задача 1.3 (`src/types.ts`, `src/App.tsx`)**:
   - Проверить и закрепить строковый тип `id: string` во всех интерфейсах и операциях удаления/поиска, убедиться в прохождении `tsc --noEmit`.
7. **Задача 2.1 и 2.2 (`README.md`, `packages/core/src/multimodal/clip-embedder.ts`)**:
   - Добавить в `README.md` таблицу `## Performance on Different Environments` (AMD EPYC 7763, Standard VPS, Browser WASM, Docker on Apple Silicon).
   - Создать `packages/core/src/multimodal/clip-embedder.ts` (`CLIPEmbedder` на `Xenova/clip-vit-base-patch32` с кросс-модальным поиском текст ↔ изображение) и экспортировать его из `@eidos/core`.
