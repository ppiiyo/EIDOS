# EIDOS Retrieval Product Layer v1

EIDOS Retrieval Product Layer v1 — нативный слой управления гибридным поиском, фильтрацией, весами полей, окнами каналов, адаптивным слиянием (Weighted RRF / Linear Fusion), подсветкой совпадений, фасетами и детерминированным кэшированием для e-commerce каталогов.

Архитектура спроектирована с нуля под стек EIDOS (`HNSW 384-d + Multi-Field BM25 + simpleCategoryGate + X-Ray`) без заимствования чужих Query DSL, схем или конфигураций сторонних поисковых движков.

---

## 1. Конвейер выполнения запроса (13 стадий)

Каждый поисковый запрос `/v1/search`, `/v1/suggest`, `/v1/demo/search`, `/v1/demo/suggest` проходит фиксированный конвейер из 13 стадий (`meta.pipelineStages`):

1. `ingest_query` — валидация входного JSON-контракта, защита от инъекций, проверка `INDEX_EMPTY` (fail-closed 503 при пустом индексе).
2. `normalize_query` — восстановление раскладки (`yfeiybrb` → `наушники`), исправление опечаток (`перфоратр` → `перфоратор`), применение словарей синонимов и стоп-слов.
3. `classify_query_shape` — детерминированная классификация формы запроса (`sku_like` | `short` | `natural`) и расчёт эффективных весов каналов (`weightsEffective`).
4. `category_gate_intent` — выделение главного товарного намерения (`headCategoryIntent`, например `Наушники и аудио`, `Смартфоны и гаджеты`).
5. `apply_catalog_constraints` — булева пред-фильтрация каталога по структурным ограничениям (`constraints` / `filters`) без влияния на релевантность (`score`).
6. `retrieve_lexical_candidates` — многополевой лексический скоринг (`scoreMultiFieldLexicalDocument`) по полям `title`, `sku`, `brand`, `category`, `description` с учётом `fieldImportance`.
7. `retrieve_dense_candidates` — векторный поиск по графу `HNSW 384-d` и точное косинусное сходство (`exactDense`) на отфильтрованном пуле.
8. `truncate_channel_windows` — усечение кандидатов каждого канала до `channelWindows.lexical` и `channelWindows.dense` (по умолчанию `50`, максимум `200`).
9. `fuse_channels` — взвешенное слияние рангов (`fusionMode: "rrf"` или `"linear"`) с записью полной формулы в `hit.fusion`.
10. `apply_business_signals` — применение правил мерчандайзинга (`pin`, `boost`, `bury`), бюджетных модификаторов и `simpleCategoryGate`.
11. `limit_sort_stable_tiebreak` — финальная сортировка по `score DESC`, при равенстве — по `id ASC`, диверсификация модельных вариаций и срез `limit`.
12. `attach_xray_highlights_facets` — генерация безопасной подсветки `hit.highlights`, расчёт фасетных счётчиков `facets` и сборка честного `X-Ray`.
13. `respond` — сохранение в кэш с привязкой к `catalogVersion` и возврат ответа клиенту.

---

## 2. Структурные ограничения каталога (`constraints`)

Ограничения отсекают товары **до** ранжирования и **не изменяют** `score`:

```json
{
  "query": "наушники",
  "constraints": {
    "category": ["Наушники и аудио"],
    "brand": ["Sony", "JBL"],
    "priceMin": 1000,
    "priceMax": 10000,
    "inStock": true,
    "ids": ["1", "2", "3"],
    "excludeIds": ["99"]
  }
}
```

- **Strict Missing Policy (`constraintStrictMissing = true`)**: если в запросе задан `priceMax` или `priceMin`, товары без валидной цены (`null` / `undefined` / `<= 0`) строго исключаются.
- **Пересечение с `simpleCategoryGate`**: `constraints.category` и `simpleCategoryGate: "hard"` работают как логическое `AND`. Если запрос `"наушники"` сопровождается фильтром `category: "Автотовары и масла"`, возвращается `0` результатов.
- **Валидация**: при `priceMin > priceMax`, отрицательной цене или неверных типах возвращается `400 Bad Request` с `code: "INVALID_CONSTRAINTS"`.
- **Метаданные ответа**:
  - `meta.constraintsApplied`
  - `meta.candidatesBeforeConstraints`
  - `meta.candidatesAfterConstraints`

---

## 3. Важность текстовых полей (`fieldImportance`)

Управляет вкладом каждого поля документа в лексический скоринг:

| Поле | Вес по умолчанию | Назначение |
|------|------------------|------------|
| `sku` | `5.0` | Точное и префиксное совпадение по артикулу / модели (`5W-40`, `WH-1000XM5`) |
| `title` | `3.0` | Совпадение в названии товара |
| `brand` | `2.0` | Совпадение по бренду |
| `category` | `1.5` | Совпадение по категории и тегам |
| `description` | `1.0` | Совпадение в описании |

- Можно переопределить на уровне запроса (`fieldImportance`) или на уровне тенанта (`PUT /v1/admin/ranking-defaults`).
- При отрицательном значении, `NaN` или неизвестном поле возвращается `400 Bad Request` с `code: "INVALID_FIELD_IMPORTANCE"`.
- В `hit.explanation.fieldImportanceContributions` возвращается вклад каждого поля `{ field, importance, boost, contribution }`.

---

## 4. Окна кандидатов каналов (`channelWindows`)

Определяют, сколько топ-кандидатов из каждого канала попадает на стадию слияния (`fuse_channels`):

```json
{
  "channelWindows": {
    "lexical": 50,
    "dense": 50
  }
}
```

- Допустимый диапазон: целые числа `1..200` (по умолчанию `50`).
- За пределами диапазона возвращается `400 Bad Request` с `code: "INVALID_CHANNEL_WINDOWS"`.

---

## 5. Взвешенное слияние каналов (`fusionMode: "rrf" | "linear"`)

### Режим `"rrf"` (по умолчанию)
Использует взвешенную формулу Reciprocal Rank Fusion с константой сглаживания `rankConstant = k` (по умолчанию `60`):

$$\text{fusedScore}(d) = \frac{w_{\text{lexical}}}{k + r_{\text{lexical}}(d)} + \frac{w_{\text{dense}}}{k + r_{\text{dense}}(d)}$$

Если документ отсутствует в окне канала, вклад этого канала равен `0`.

### Режим `"linear"`
Использует min-max нормализацию скоров внутри окна каждого канала:

$$\text{fusedScore}(d) = w_{\text{lexical}} \cdot \widehat{s}_{\text{lexical}}(d) + w_{\text{dense}} \cdot \widehat{s}_{\text{dense}}(d)$$

Каждый товар в выдаче содержит объект `hit.fusion` (и алиас `hit.rrf`):
```json
{
  "mode": "rrf",
  "k": 60,
  "lexicalRank": 1,
  "denseRank": 4,
  "lexicalWeight": 0.65,
  "denseWeight": 0.35,
  "lexicalContribution": 0.010656,
  "denseContribution": 0.005469,
  "fusedScore": 0.016125
}
```

---

## 6. Авто-смещение весов по форме запроса (`queryShape`)

Детерминированный классификатор без LLM определяет форму запроса:

- `sku_like` — артикулы, коды с цифрами и дефисами (`"5W-40"`, `"WH-1000XM5"`, `"18V"`): усиливает лексический канал (`lexical *= 1.25`, `semantic *= 0.85`).
- `short` — короткие 1–2 словные запросы без цифр (`"наушники"`, `"перфоратор"`): лёгкое смещение в пользу лексики (`lexical *= 1.10`, `semantic *= 0.92`).
- `natural` — естественные многословные запросы (`"недорогие наушники для бега"`): усиливает семантический канал (`lexical *= 0.95`, `semantic *= 1.05`).

После умножения веса нормализуются к сумме `1.0` с защитным ограничением `[0.15, 0.85]` и возвращаются в `meta.queryShape` и `meta.weightsEffective`.

---

## 7. Безопасная подсветка (`highlights`) и фасеты (`facets`)

- **`hit.highlights`**: возвращает экранированные от XSS строки `title` и `sku`, где совпавшие токены и морфологические основы обёрнуты в `<em>...</em>`.
- **`facets`**: при передаче `"facets": ["brand", "category"]` возвращает в корне ответа объект `facets` с агрегированными счётчиками `{ value, count }[]`, рассчитанными по пулу кандидатов после `constraints` и `simpleCategoryGate`.

---

## 8. Кэширование и инвалидация (`catalogVersion`)

- Ключ кэша включает `normalizedQuery`, `constraints`, `simpleCategoryGate`, `weightsEffective`, `channelWindows`, `fieldImportance`, `fusionMode`, `limit` и `catalogVersion`.
- Любая мутация каталога (`upsert`, `delete`, `clear`, `loadDemoCatalog`) атомарно увеличивает `catalogVersion` и сбрасывает кэш.
- В ответе возвращаются `meta.cacheHit: boolean` и `meta.catalogVersion: number`.
