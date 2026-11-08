# EIDOS Retrieval Product Layer v1

См. полную спецификацию и документацию конвейера в [`docs/RETRIEVAL.md`](./docs/RETRIEVAL.md).

## Быстрая сводка возможностей
- **13-стадийный конвейер**: от `ingest_query` и `classify_query_shape` до `attach_xray_highlights_facets`.
- **`constraints`**: булева пред-фильтрация (`category`, `brand`, `priceMin`, `priceMax`, `inStock`, `ids`, `excludeIds`) со строгой политикой пропущенных цен (`constraintStrictMissing: true`).
- **`fieldImportance`**: настраиваемые веса полей (`sku: 5`, `title: 3`, `brand: 2`, `category: 1.5`, `description: 1`) с полной расшифровкой в X-Ray.
- **`channelWindows`**: независимые окна кандидатов `lexical` и `dense` (`1..200`, по умолчанию `50`).
- **`fusionMode`**: `"rrf"` (Weighted RRF с `rankConstant = 60`) и `"linear"` (min-max нормализованное линейное слияние).
- **`queryShape`**: автоматическая классификация `sku_like | short | natural` и адаптация `weightsEffective`.
- **`highlights` & `facets`**: XSS-безопасная подсветка `<em>` в `title`/`sku` и фасетные счётчики по `brand` и `category`.
- **`catalogVersion` Cache**: детерминированный кэш с мгновенной инвалидацией при обновлениях каталога.
