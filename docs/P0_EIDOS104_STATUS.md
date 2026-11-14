# EIDOS-104 & EIDOS-105 Status

## Completed on `main`

1. **`store-registry.ts` & `vector-store.ts`**: Snapshot load runs before WAL replay under a unified readiness barrier (`whenReady()` / `setReadyPromise()`), with synchronous 64 KB chunked snapshot restoration for binary-paired `.hnsw.bin` indices.
2. **Fail-Closed Embedding Space Guard**: `server.ts` and `vector-store.ts` verify `<snapshot>.meta.json` (`embeddingSpaceId`, `embeddingModel`, `embeddingMode`) and throw `EmbeddingSpaceMismatchError` instead of serving corrupted search results when the configured model changes without reindexing.
3. **`EIDOS-104` (`demo-product-category-families.ts`)**: `PRODUCT_CATEGORY_FAMILIES` and `CategoryFamilySpec` are extracted to `packages/core/src/search/demo-product-category-families.ts` (and re-exported from `ranking-guardrails.ts` for backward compatibility), while `extractHeadCategoryIntent` supports per-tenant `customFamilies` and dynamically derived catalog families (`buildDynamicCategoryFamiliesFromCatalog`).
4. **`EIDOS-105` (`totalIsApproximate` & Deep Pagination)**: `VectorStore.hybridSearch` provides deep pagination candidate headroom (`offset + limit + 50`), and `/v1/search` reports `totalIsApproximate` in both top-level responses and `meta` across fresh, exact-cached, and semantic-cached hits.
