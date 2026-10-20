# План глубокой ревизии, зачистки и модернизации Eidos Engine

## 1. Полная зачистка дубликатов и «мёртвого» кода (Dead Code Elimination)

Мы полностью очистим репозиторий от дублирующихся приложений, конфликтующих локфайлов и неиспользуемых компонентов, сохранив единый источник истины (Single Source of Truth):

- **Удаление дублирующихся под-приложений**:
  - Удалить `apps/workspace/` (100% устаревший дубликат корневого приложения `/src`).
  - Удалить `apps/landing/` (неиспользуемый скелет на Next.js 14).
  - Обновить `pnpm-workspace.yaml` и `package.json`, чтобы оставить чистую структуру: корневое рабочее пространство студии (`/src`), ядро `@eidos/core` (`packages/core/`) и Fastify REST API (`apps/api/`).
- **Устранение конфликта пакетных менеджеров**:
  - Удалить `bun.lock` из корня проекта, оставив единый `pnpm-lock.yaml`.
- **Удаление 12 неиспользуемых UI-компонентов из `src/components/`**:
  - `AnalysisView.tsx`, `ConversationalAgentView.tsx`, `EidosLogo.tsx`, `ExportView.tsx`, `FeedImporterModal.tsx`, `Header.tsx`, `Modals.tsx`, `PitchModal.tsx`, `PresentationLandingView.tsx`, `ProductCard.tsx`, `RoiCalculatorModal.tsx`, `VisualExplanationLayer.tsx`.
- **Удаление дублирующихся утилит из `src/utils/`**:
  - Удалить `src/utils/semanticEngine.ts` (дубликат `recommenderEngine.ts`).
  - Консолидировать `src/utils/featureAttribution.ts` и `src/utils/securityGuardrails.ts` с каноничными реализациями в `@eidos/core`.

---

## 2. Исправление выявленных багов и уязвимостей безопасности

- **Исправление бага «призрачного» выбранного элемента (`src/App.tsx`)**:
  - В `handleDeleteItem(id)` проверять, совпадает ли удаляемый `id` с `selectedItem?.id`. Если да — автоматически переключать `selectedItem` на первый доступный элемент актуального каталога (`nextCatalog[0] || null`).
- **Исправление сброса пресета при масштабировании до 1 200+ элементов (`src/App.tsx` и `src/utils/recommenderEngine.ts`)**:
  - Модифицировать `handleScaleCatalog` и `generateSyntheticScaledCatalog(targetCount, baseCatalog)` так, чтобы масштабирование сохраняло текущий выбранный домен (`activeDomain`: Российский маркетплейс, Стриминг, Японский видеохостинг 動画・配信 или Global Multilingual), а не сбрасывало витрину к `INITIAL_CATALOG`.
- **Честный расчёт MMR X-Ray и управление `limit` (`src/App.tsx`, `src/types.ts`, `src/components/RecommendationsView.tsx`)**:
  - Расширить интерфейс `CatalogRecommendation` полями `mmrScore`, `noveltyBonus` (`1 - maxSimToAlreadySelected`) и `rank`.
  - Возвращать точные математические значения напрямую из цикла MMR в `App.tsx`, убрав аппроксимацию из `RecommendationsView.tsx`.
  - Подключить в UI `RecommendationsView` селектор `Top-K Limit` (`4`, `6`, `8`, `12`).
- **Защита импорта данных и REST API (`SecurityGuardrails` & Auth)**:
  - Внедрить проверку и санитизацию через `SecurityGuardrails.sanitizeInput()` и `detectPromptInjection()` во все точки ввода: `CsvImporterModal`, `DatabaseConnectorModal` (REST/Webhook JSON), создание нового товара в `CatalogView` и поисковые запросы.
  - В `apps/api/src/server.ts` добавить middleware проверки заголовка `x-api-key` / `Authorization: Bearer` для мутирующих эндпоинтов (`POST /v1/catalog`, `POST /v1/feedback`) и санитизацию входных документов через `SecurityGuardrails`.

---

## 3. Полная мультиязычность интерфейса студии (UI Localization: RU / EN / JA)

Чтобы платформа выглядела монолитно и безупречно для клиентов из России/СНГ, США/Европы и Японии:

- **Словарь локализации интерфейса (`src/i18n/uiTranslations.ts`)**:
  - Создать типизированную систему переводов интерфейса для трёх языков: **Русский (`RU`)**, **English (`EN`)**, **日本語 (`JA`)**.
  - Охватить навигацию (`Sidebar`), верхнюю панель (`App.tsx`), карточки KPI и бенчмарков (`DashboardView`), гибридный поиск (`SearchView`), рекомендации и правила мерчандайзинга (`RecommendationsView`), 3D/2D векторное пространство (`VectorSpaceView`), A/B тестирование и аналитику.
- **Переключатель языка интерфейса в шапке (`RU | EN | JA`)**:
  - Добавить компактный переключатель языка UI в верхнюю панель студии.
  - При переключении пресета базы данных (например, на японский видеохостинг `video_jp`) предлагать или синхронизировать язык объяснений и интерфейса.

---

## 4. Внедрение киллер-фич уровня Algolia Recommend / AWS Personalize / Qdrant

Мы закроем главные функциональные пробелы по сравнению с топ-конкурентами прямо в интерактивной студии:

1. **Merchandising & Business Rules Studio (в `RecommendationsView` и `SearchView`)**:
   - **Pinning (Закрепление SKU)**: возможность закрепить любой товар/видео на 1-м месте выдачи (Sponsored / Pinned Slot).
   - **Exclude / Hide (Скрытие)**: быстрое исключение нежелательных позиций или фильтрация «Только другие категории» (Cross-Category Only).
   - **Category Boost (Бустинг категории)**: множитель веса (`1.0x` – `2.0x`) для приоритетной категории бизнеса (например, повышение маржинальных товаров или оригинального контента платформы).
   - **Price / Rating Guardrail**: фильтр минимального рейтинга (например, `★ ≥ 4.7`) для рекомендательного блока.
2. **Панель метрик качества ранжирования в реальном времени (Evaluation Metrics Bar)**:
   - Расчёт и отображение стандартных индустриальных метрик качества поверх текущей выдачи:
     - **NDCG@K** (Normalized Discounted Cumulative Gain — качество порядка ранжирования).
     - **Recall@K** (полнота охвата релевантного кластера).
     - **MRR** (Mean Reciprocal Rank — позиция первого высокорелевантного ответа).
     - **ILS / Shannon Entropy** (Intra-List Diversity в битах).

---

## 5. Верификация и сборка

- Проверить отсутствие неиспользуемых импортов и ошибок типизации (`lint_applet` / `compile_applet`).
- Запустить unit и E2E тесты ядра `@eidos/core`, убедившись, что все тесты проходят на 100%.
