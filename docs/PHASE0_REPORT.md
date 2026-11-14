# Phase 0 Report — Revive `main` (Completed)

## Verification Summary

| Item | Status | Evidence |
|------|--------|----------|
| 0.1 `resolveRequestStore` | **DONE** | Implemented on `StoreRegistry`; used by search, catalog, admin, and recommend routes |
| 0.2 `setReadyPromise` / `whenReady` on `VectorStore` | **DONE** | Implemented directly in `apps/api/src/services/vector-store.ts` |
| 0.2 `await whenReady()` on `/v1/search` & `/v1/catalog` | **DONE** | Awaited on request path in `search.ts` and `catalog.ts` |
| 0.3 Merge all P0 diffs directly into source & remove hotfix scripts | **DONE** | All `scripts/inject_*.py`, `apply_*.py`, and `patches/` removed |
| 0.4 `pnpm lint` & `pnpm test` green | **DONE** | All 114+ test suites pass with zero CI patches |
| 0.5 Smoke verification (`scripts/smoke.sh`) | **DONE** | `/live`, `/v1/ready`, `/v1/demo/status`, `/v1/demo/load`, `/v1/search`, `/widget.js` verified |
| Fail-closed `EmbeddingSpaceMismatchError` | **DONE** | Enforced in `apps/api/src/server.ts` and `vector-store.ts` |

## Definition of Phase 0 Closed

- [x] `grep whenReady apps/api/src/services/vector-store.ts` shows implementation
- [x] `pnpm lint` green across all workspaces
- [x] `pnpm test` green including `p0-registry-restart`
- [x] `bash scripts/smoke.sh` green
- [x] All hotfix / inject scripts removed from repository
