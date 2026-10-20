# План реализации: Подготовка Browser-First релиза Eidos

## Контекст и ключевые принципы
Продукт строится по стратегии **Browser-First**: весь основной цикл (индексация до ~50 000 товаров, 384-мерные эмбеддинги MiniLM/E5 через `@xenova/transformers`, HNSW, гибридный поиск BM25 + Dense, MMR-диверсификация, контекстуальные бандиты и A/B-движок) работает целиком во вкладке браузера без обязательного сервера.

Зафиксированные архитектурные решения:
1. **Архитектура монорепо (`apps/workspace`)**: Основной фронтенд переносится в `apps/workspace`, корневой `vite.config.ts` и `package.json` проксируют сборку и dev-сервер (порт 3000) в `apps/workspace`, а дублирующий корневой каталог `src/` удаляется.
2. **Честная семантика и статус модели**: Полный отказ от псевдо-эмбеддингов на n-граммах/якорях, маскирующихся под нейросеть. Пока ONNX/WASM модель (`Xenova/all-MiniLM-L6-v2` / `Xenova/multilingual-e5-small`) скачивается и инициализируется, UI отображает честный прогресс и явно работает в лексическом режиме **BM25**, не фабрикуя проценты семантического сходства.
3. **Строгие инварианты вычислений**: Любое несовпадение размерностей векторов (`a.length !== b.length`) и любые `NaN`/`Infinity` или невалидные гиперпараметры немедленно выбрасывают `RangeError` (никаких `Math.min(a.length, b.length)`).
4. **Хранилище**: `localStorage` используется исключительно для настроек UI; каталог товаров, `Float32Array` эмбеддинги и снимки индексов хранятся в **IndexedDB**.
5. **Модульность**: Ни один UI-компонент не превышает **300 строк**; каждое изменение сопровождается TDD-тестом (падает до фикса, зеленеет после).

---

## Фаза 1: Строгие математические инварианты в `@eidos/core` (TDD)
- **`packages/core/src/cosine.ts`**:
  - Заменить `Error` на `RangeError` при `a.length !== b.length` или пустых векторах, а также добавить проверку входных координат на `Number.isFinite` (выбрасывать `RangeError` при `NaN` / `Infinity`).
- **`packages/core/src/hnsw.ts`, `bm25.ts`, `hybrid-search.ts`, `diversity.ts`, `bandits.ts`, `ab-testing.ts`**:
  - Ввести стартовую валидацию конфигурации и входных векторов: проверять `dimension > 0`, `M >= 2`, `efConstruction >= M`, `efSearch >= 1`, `k1 > 0`, `b ∈ [0, 1]`, `lambda ∈ [0, 1]`, `rrfK > 0`, а также размерность и конечность (`Number.isFinite`) каждого добавляемого/искомого вектора с выбрасыванием `RangeError`.
- **TDD-тесты (`packages/core/test/strict-validation.test.ts`)**:
  - Написать тесты, проверяющие выбрасывание `RangeError` на векторах разной длины, векторах с `NaN`/`Infinity` и невалидных конфигах HNSW/BM25/MMR/Bandits.

---

## Фаза 2: Честный браузерный пайплайн эмбеддингов (ONNX/WASM + явный BM25)
- **Удаление псевдо-семантики**:
  - Удалить `computeTextEmbedding` на базе хэш-бакетов и жёстко закодированных словарей (`RECOMMENDER_ANCHORS`) и локальный `cosineSimilarity` с `Math.min(a.length, b.length)`.
  - Использовать единую реализацию `cosineSimilarity` из `@eidos/core`.
- **Менеджер модели (`embeddingPipeline.ts`)**:
  - Явная конечная машина состояний модели: `'idle' | 'loading' | 'ready' | 'error'` с прогрессом скачивания весов ONNX/WASM.
  - Пока статус `!== 'ready'`, поиск и рекомендации работают в явно маркированном режиме `BM25 (Lexical Only)` с честным бейджем в интерфейсе; семантический скор и 384-d HNSW активируются только при наличии реальных векторов модели.
  - Батч-индексация с отдачей управления циклу событий (`requestIdleCallback` / чанки), чтобы интерфейс оставался отзывчивым на каталогах до 50 000 позиций.

---

## Фаза 3: Миграция каталога и векторов в IndexedDB
- **Слой хранения (`idbCatalogStore.ts`)**:
  - Создать типизированное хранилище на базе нативного `IndexedDB` (объектные хранилища `catalog_items`, `embeddings_384d`, `index_snapshots`, `projects`) с пакетной записью (`readwrite` транзакции батчами по 500–1000 записей) и хранением векторов в бинарном `Float32Array` (`ArrayBuffer`) без JSON-сериализации массивов чисел.
- **Разделение ответственности с `localStorage`**:
  - Удалить запись `eidos_catalog_*` из `localStorage`.
  - Оставить в `localStorage` только легковесные настройки интерфейса (тема, язык, активная вкладка).
- **Тесты персистентности**:
  - Покрыть тестами сохранение/чтение/очистку каталога и бинарных `Float32Array` векторов через `fake-indexeddb` / мок-адаптер IndexedDB.

---

## Фаза 4: Перенос в `apps/workspace` и декомпозиция компонентов (< 300 строк)
- **Структура `apps/workspace`**:
  - Перенести фронтенд в `apps/workspace/src/`, настроить корневой `vite.config.ts` и `index.html` для прозрачного запуска `apps/workspace` на порту 3000 AI Studio и удалить устаревший корневой `src/`.
- **Декомпозиция компонентов до лимита ≤ 300 строк**:
  - Разбить монолитные представления на компактные доменные модули (< 300 строк каждый):
    - `App.tsx` → оболочка маршрутизации + хуки `useCatalogStore`, `useEmbeddingModel`, `useWorkspaceSearch`.
    - `RecommendationsView.tsx` → `RecommendationControls.tsx`, `RecommendationCardList.tsx`, `XRayInspectorPanel.tsx`.
    - `CatalogView.tsx` → `CatalogToolbar.tsx`, `CatalogTable.tsx`, `CatalogItemDrawer.tsx`.
    - `SearchView.tsx` → `SearchHeader.tsx`, `SearchResultsList.tsx`, `ModelStatusBanner.tsx`.
    - `ABTestView.tsx` → `ABExperimentForm.tsx`, `ABMetricsBoard.tsx`, `BanditSimulationPanel.tsx`.
    - `GraphView.tsx` & `VectorSpaceView.tsx` → вынос рендереров канваса, тулбаров фильтрации и инспекторов узлов в отдельные подкомпоненты.
    - `LaunchKitView.tsx` → разбиение на секции SDK-сниппетов и экспорта индекса.

---

## Фаза 5: Верификация и автоматический контроль качества
- Автоматический тест-инвариант (`architecture-constraints.test.ts`), проверяющий:
  - отсутствие корневого легаси-каталога `src/`;
  - что каждый `.tsx`/`.ts` компонент в `apps/workspace/src/components` содержит **≤ 300 строк**;
  - отсутствие вызовов `Math.min(a.length, b.length)` и записи каталога в `localStorage`.
- Прогон полного набора тестов `vitest` и проверка продакшен-сборки через `compile_applet`.
