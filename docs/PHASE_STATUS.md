# EIDOS Phase & Readiness Status

## Completed on `main`
- **Phase 0**: `resolveRequestStore`, `whenReady`, `wasEmptyBeforeRestore` reconciliation, `/v1/search` & `/v1/catalog` readiness barrier.
- **Phase 1**: Streaming chunked snapshots (`.jsonl` / `.json`), `.hnsw.bin` SHA-256 verification, bounded in-memory WAL, synchronous `saveSnapshotSync()` before WAL truncation.
- **Phase 2**: Multilingual ONNX embedder (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`), explicit `lexical-only` mode, snapshot `.meta.json` model verification.
- **Phase 3**: Honest brute-force `Recall@K` (`evaluateRecallAtK`), JWT `jti` revocation (`POST /v1/admin/jwt/revoke`), XXE-safe linear YML parser, SSRF-guarded feed fetcher.
- **Phase 4**: Strict CORS with `Vary: Origin`, IP-bound rate-limit fallback for unknown API keys, authenticated `/metrics` and funnel events, `0600` secret generation in pilot installers.
- **Phase 5**: Storefront widget i18n (`ru`/`en`, `RUB`/`USD`/`EUR`, `urlTemplate`) + automatic Vite build sync, TS & Python SDK parity, canonical Bitrix & WooCommerce packagers, `demo-product-category-families.ts` separation (`EIDOS-104`), and `totalIsApproximate` reporting (`EIDOS-105`).

## Pilot & Production Readiness
**Ready.** All unit, integration, security, and acceptance suites pass with zero CI patch scripts, `@eidos/core` coverage exceeds thresholds (`≥80%` lines, `≥75%` branches), and `scripts/smoke.sh` passes end-to-end.
