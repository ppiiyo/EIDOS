# EIDOS — Engine P1: High-ROI Retrieval Controls (`docs/RETRIEVAL_P1.md`)

See root [`/RETRIEVAL_P1.md`](../RETRIEVAL_P1.md) for the full specification of:
- **Feature A**: Multi-field lexical BM25 `fieldBoosts` (`DEFAULT_FIELD_BOOSTS = { title: 3, sku: 5, brand: 2, category: 1.5, description: 1 }`)
- **Feature B**: Structured pre-RRF `filters` (`category`, `brand`, `priceMin`, `priceMax`, `inStock`, `ids`, `excludeIds`) and strict intersection with `simpleCategoryGate: 'hard'`
- **Feature C**: Per-channel `rankWindow` (`{ lexical: 50, dense: 50 }`, range `1..200`)
- **Feature D**: Formalized Weighted RRF (`rankConstant`, `weights`, `hit.rrf`) and `GET/PUT /v1/admin/ranking-defaults`
