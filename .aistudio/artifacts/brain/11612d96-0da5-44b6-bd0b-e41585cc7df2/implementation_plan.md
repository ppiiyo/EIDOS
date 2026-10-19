# EIDOS Ultimate — Unified Semantic Vector Workbench & Adaptive RecSys Studio

Трансформация EIDOS в целостную инженерную платформу семантического поиска и рекомендаций: устранение критических математических рассинхронизаций ядра (`64d` vs `384d`), подключение реального гибридного индекса `HNSW Phase 2 + BM25`, вывод всех скрытых модулей (`3D WebGL Universe`, `2D Topology Graph`, `Adaptive Intelligence Lab`, `Vector Batch Import/Export`, `Live API Console`) в единое рабочее пространство с переключаемой светлой и тёмной темой.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Ниже зафиксированы архитектурные и продуктовые решения, подтверждённые на этапе уточнения требований.

- **Confirmed Decision 1 — Полный апгрейд ядра, модулей и UI**: Устраняются все выявленные ошибки кода (размерность 384d, сквозной `selectedItem`, реальный HNSW-бенчмарк), подключаются все изолированные компоненты и проводится полное визуальное объединение интерфейса.
- **Confirmed Decision 2 — Переключаемая тема (Dark Engineering + Light Clean Studio)**: Вводится глобальная система дизайн-токенов с мгновенным переключением между глубокой тёмной инженерной палитрой (`#0B0F19`) и чистой светлой студийной темой (`#F8FAFC`) с сохранением выбора в `localStorage`.
- **Confirmed Decision 3 — Включение всех 4 групп киллер-фич в главное рабочее пространство**:
  1. **3D WebGL Вселенная и 2D Граф связей** (`Hypersphere`, `HNSW Layers L0/L1/L2`, `INT8 Grid`, `Force-Directed Graph`).
  2. **Лаборатория Adaptive Intelligence Layer (AIL)** (7-факторный ранжер, капсулы интересов `MIND`, контекстные бандиты `LinUCB / Thompson Sampling`, `Vector Steering`).
  3. **Гибридный поиск (`BM25 + Dense HNSW`) + Side-by-Side сравнение** против классического ключевого поиска с регулировкой коэффициента $\alpha$.
  4. **Импорт/Экспорт векторных бандлов (`CSV / JSON 0ms`) и интерактивная REST API-консоль**, выполняющая реальные расчёты по текущему каталогу.

---

## 1. Overview & Core Concept

- **What It Does**: EIDOS Ultimate предоставляет разработчикам, ML-инженерам и e-commerce командам полноценную среду для управления товарным каталогом, мгновенной векторизации (384d), гибридного поиска (`BM25 + HNSW`), диверсифицированных рекомендаций (`MMR / SMMR` + энтропия Шеннона), визуальной 3D/2D-инспекции векторного пространства и тестирования алгоритмов персонализации.
- **Target Audience / Persona**:
  - **RecSys & Search инженеры**: настройка весов ранжирования, проверка Recall@K и латентности HNSW против линейного сканирования, тестирование бандитов и A/B-экспериментов.
  - **Product & E-commerce менеджеры**: проверка качества поисковой выдачи на сложных смысловых запросах, устранение холодного старта новинок, импорт/экспорт каталогов.
- **Key Value**: Полная прозрачность алгоритмов («White-Box RecSys») — каждая рекомендация и поисковая выдача сопровождается математической декомпозицией скора, трассировкой в 3D-пространстве и живым сравнением с классическим поиском без облачной привязки.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **System Overview & Real HNSW Benchmark**:
   - На главном экране пользователь видит реальные метрики индекса (количество SKU, размерность 384d, статус HNSW и BM25, энтропию каталога).
   - Запуск **HNSW Phase 2 vs Linear Scan Benchmark** выполняет серию запросов одновременно через граф `HNSWIndex` и через полный перебор, выводя реальное ускорение (`Speedup`), `Recall@10`, `p50/p99` латентность и генератор масштабирования каталога до **1 200+ товаров** в один клик.
2. **Hybrid Search & Side-by-Side Comparison (`BM25 + Dense HNSW` vs `Legacy Keyword`)**:
   - Пользователь вводит смысловой запрос (или выбирает пресет), настраивает ползунок гибридного баланса $\alpha \in [0, 1]$ (`0.0` = чистый лексический BM25, `1.0` = чистый семантический HNSW) и включает режим **Side-by-Side Compare**.
   - Слева отображается гибридная выдача EIDOS с разбивкой `Dense Score` + `BM25 Score` + `RRF Rank`, справа — выдача обычного поиска по совпадению слов, наглядно демонстрируя преодоление словарного разрыва.
3. **Recommendations & Explainable X-Ray**:
   - При клике на любой товар в любом модуле он автоматически становится целевым якорем (`selectedItem`) в модуле рекомендаций.
   - Пользователь регулирует `MMR Diversity` ($\lambda$) и видит не только итоговый процент близости, но и **X-Ray декомпозицию факторов**: вклад косинусного сходства, штраф за повтор категории, прирост энтропии Шеннона и семантическое объяснение.
4. **3D Vector Space & 2D Topology Explorer**:
   - Переключаемый 3D WebGL / 2D Canvas модуль:
     - **3D WebGL режим**: проекция 384-мерных векторов на гиперсферу, переключение в режим **HNSW Multi-Layer Stack ($L_0, L_1, L_2$)** и **INT8 Quantized Lattice**, интерактивный полёт зонда **Vector Steering ($\Delta v$)**.
     - **2D Force Graph режим**: физическая кластеризация товаров и концептов с расчётом центральности (`Betweenness / Degree`) и фильтрацией порога связей.
5. **Adaptive Intelligence Lab (AIL)**:
   - Интерактивная лаборатория с 4 вкладками: **Multi-Feature Ranker** (7 ползунков весов с живым пересчётом топа), **Multi-Interest Capsules (MIND)** (разделение истории пользователя на независимые капсулы интересов), **Contextual Bandits** (симуляция кликов/покупок в `LinUCB` и `Thompson Sampling` с обновлением матриц в реальном времени) и **Vector Steering** (векторная арифметика положительных и отрицательных модификаторов).
6. **Catalog Management, 0ms Vector Bundles & Live API Console**:
   - Таблица каталога с быстрым фильтром, добавлением товаров, **импортом CSV / JSON-бандлов** с предрассчитанными 384d-векторами и **экспортом `eidos-vectors-bundle-v1`**.
   - В шапке всегда доступна кнопка **API Console**, открывающая интерактивный терминал (`cURL / TypeScript / Python`), который выполняет реальные запросы к живому движку в памяти браузера.

### Visual Identity & Theme
- **Aesthetic Direction**: Прецизионная инженерная консоль данных (в духе Linear, Raycast и Vercel Observability) — строгая сетка, одноуровневая глубина карточек (`Single-Elevation Depth`), тонкие `1px` границы, отсутствие визуального шума и декоративных капсул.
- **Color Palette & Dual-Theme Tokens (60-30-10 Allocation)**:
  - **Light Studio Theme**:
    - *60% Dominant Canvas*: `#F8FAFC` (`--bg-canvas`), чистый структурный фон.
    - *30% Structural Surfaces*: `#FFFFFF` (`--bg-surface`), границы `#E2E8F0` (`--border-subtle`), основной текст `#0F172A`, вторичный `#475569`.
    - *10% High-Intent Accent*: Инженерный кобальт `#2563EB` (`--accent-primary`), изумрудный `#059669` (подтверждённые метрики и высокий Recall), янтарный `#D97706` (режим fallback/предупреждения).
  - **Dark Engineering Theme**:
    - *60% Dominant Canvas*: Глубокий обсидиан `#0B0F19` (`--bg-canvas`).
    - *30% Structural Surfaces*: Карточки `#111827` (`--bg-surface`), границы `#1E293B` (`--border-subtle`), основной текст `#F8FAFC`, вторичный `#94A3B8`.
    - *10% High-Intent Accent*: Электрический кобальт/циан `#3B82F6` / `#06B6D4` для активных контролов и векторных лучей.
- **Typography & Hierarchy (2+1 Font Rule)**:
  - *Display & UI Structure*: `Plus Jakarta Sans` (`600/700`, `text-wrap: balance`, плотный трекинг `-0.02em` для заголовков).
  - *Body & Prose*: `Plus Jakarta Sans` (`400/500`, `14px–15px` для плотных таблиц и карточек).
  - *Telemetry, Vectors & Scores*: `JetBrains Mono` с обязательным `font-variant-numeric: tabular-nums` для всех задержек (`ms`), скоров (`0.942`), размерностей (`384d`) и табличных колонок.
- **Zero-Pill & Spatial Discipline**:
  - Статические метаданные (категория, ID, размерность, теги) выводятся чистым текстом через типографский разделитель `·` без цветных капсул-бейджей.
  - Сегментированные переключатели режимов (`Hybrid | Dense | BM25`, `3D Universe | 2D Force Graph`, `Light | Dark`) оформлены как строгие функциональные кнопки с чётким активным состоянием.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Унификация размерности эмбеддингов на 384 измерениях**:
  - *Chosen Approach*: Расширить детерминированный локальный эмбеддер `computeTextEmbedding` с 64 до **384 измерений** (с проекцией семантических якорей, морфологических символьных n-грамм и ортогональных гармоник).
  - *Why*: Обеспечивает 100% математическую совместимость с `Xenova/multilingual-e5-small` (384d), `all-MiniLM-L6-v2` (384d), `HNSWIndex`, `AdaptivePanel` и экспортируемыми JSON-бандлами без обнуления скалярного произведения.
- **Decision 2 — Реальный `HNSWIndex` + `BM25Index` (`HybridSearch`) в клиентском ядре**:
  - *Chosen Approach*: Инициализировать и синхронизировать экземпляры `HNSWIndex` и `BM25Index` из `@eidos/core` непосредственно при изменении каталога в React-состоянии.
  - *Why*: Позволяет выполнять настоящий гибридный поиск с Reciprocal Rank Fusion (RRF) и честный бенчмарк `HNSW vs Linear` за доли миллисекунды прямо в браузере.
- **Decision 3 — Сквозной контекст выбранного товара (`selectedItem`) и глобальные модальные инструменты**:
  - *Chosen Approach*: Хранить `selectedItem` на уровне `App` и передавать его во все модули (`Recommendations`, `3D Vector Space`, `Adaptive Lab`, `API Console`).
  - *Why*: Клик по любому товару в поиске, каталоге или 3D-сцене мгновенно фокусирует всю аналитику и рекомендации именно на этом товаре.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                       EIDOS ULTIMATE WORKBENCH (App State & Theme)                     │
│  • Theme Engine (Light Studio / Dark Engineering CSS Variables)                        │
│  • Unified 384-d Embedding Pipeline (Transformers.js E5-Small + 384-d Deterministic)   │
│  • Live Core Indices: HNSWIndex (Phase 2 Int32) + BM25Index + HybridSearch (RRF)       │
└───────────────┬────────────────────────────────────────────────────────┬───────────────┘
                │                                                        │
                ▼                                                        ▼
┌───────────────────────────────────────┐      ┌─────────────────────────────────────────┐
│        PRIMARY WORKSPACE VIEWS        │      │       GLOBAL TOOLS & MODAL ENGINES      │
├───────────────────────────────────────┤      ├─────────────────────────────────────────┤
│ 1. Dashboard & HNSW Scale Benchmark   │      │ • Live REST API Console (cURL/TS/Py)    │
│    (Real HNSW vs Linear + 1.2k Scale) │      │   Executes against live HNSW/BM25 store │
│ 2. Hybrid Search & Side-by-Side Lab   │      │ • Vector Bundle Exporter (JSON 384-d)   │
│    (BM25 + Dense α slider vs Keyword) │      │ • Zero-Inference Batch Importer (JSON)  │
│ 3. Recommendations & Score X-Ray      │      │ • CSV Catalog Importer with Auto-Embed  │
│    (MMR λ + Shannon Entropy + Bars)   │      └─────────────────────────────────────────┘
│ 4. 3D Vector Space & 2D Force Graph   │
│    (Three.js L0-L2 / INT8 + 2D Graph) │
│ 5. Adaptive Intelligence Lab (AIL)    │
│    (Ranker + MIND Capsules + Bandits) │
│ 6. Catalog & Vector Bundle Manager    │
│ 7. A/B Experiments & Conversational   │
│ 8. Recharts Trends & Session Metrics  │
└───────────────────────────────────────┘
```

### Interactive Component & State Mapping
- **Глобальная шапка и навигация**:
  - Переключатель темы (`Light / Dark`), индикатор режима эмбеддингов (`E5-Small 384d WASM` / `Deterministic 384d`), кнопка быстрого вызова `API Console`, кнопка `Import / Export Bundles` и живой монитор памяти `HNSW Heap`.
- **Модуль `DashboardView`**:
  - Карточки реальных метрик каталога и сессии, переключатель масштабирования каталога (`Scale to 1,200+ Items` для демонстрации логарифмического ускорения HNSW и возврат к базовому каталогу), честный тест `benchmarkHnswVsLinear` с выводом `HNSW Latency`, `Linear Latency`, `Speedup Ratio` и `Recall@10`.
- **Модуль `SearchView` (Hybrid Search + Side-by-Side)**:
  - Поле поиска с пресетами, переключатель режима (`Hybrid RRF`, `Pure Dense Vector`, `Pure BM25 Lexical`), ползунок веса $\alpha$, тоггл `Compare with Legacy Keyword Search` (двухколоночный режим сравнения) и кликабельный переход к рекомендациям или 3D-узлу товара.
- **Модуль `RecommendationsView` (MMR + Explainability X-Ray)**:
  - Выбор целевого товара (автоматически подхватывает `selectedItem` при переходе из других вкладок), ползунок `MMR Diversity` ($\lambda$), расчёт **Shannon Category Entropy** выдачи и визуальные шкалы вклада факторов для каждого рекомендованного товара.
- **Модуль `VectorSpaceView` (объединяющий `VectorCanvas3D` и `GraphView`)**:
  - Верхний сегментированный контрол переключает между **3D WebGL Universe** (режимы `Hypersphere`, `HNSW Layers L0/L1/L2`, `INT8 Quantized Grid` + интерактивный `Vector Steering Probe`) и **2D Force Topology Graph** (с настройкой порога близости и инспекцией кластеров).
- **Модуль `AdaptivePanel` (AIL Lab)**:
  - Доступен прямо из бокового меню: управление 7 весами ранжера, маршрутизация капсул интересов `MIND`, интерактивный симулятор бандитов `LinUCB / Thompson Sampling` и векторная арифметика `Vector Steering`.
- **Модуль `AnalyticsView` (Session Metrics + `SemanticTrendsAnalytics`)**:
  - Объединяет реальную телеметрию текущей сессии (CTR, конверсия, топ запросов) и интерактивные графики `Recharts` из `SemanticTrendsAnalytics` (динамика запросов, латентность и тематические кластеры).
