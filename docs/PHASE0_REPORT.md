# Phase 0 report — revive main

**Date:** 2026-11-12  
**Commit with resolveRequestStore:** `b2546b7`

## Verification (against main before/after)

| Item | Status | Evidence |
|------|--------|----------|
| 0.1 `resolveRequestStore` missing | **FIXED** | Implemented on `StoreRegistry`; used by search/catalog/admin/recommend call sites |
| 0.2 `setReadyPromise` / `whenReady` on VectorStore | **OPEN on main file** | Registry calls them; implementation is in `patches/vector-store.p0.diff` + `scripts/apply_master_p0.py` (method-scoped inject). **Must apply before tsc is green.** |
| 0.2 await whenReady on search/catalog | **PARTIAL** | Patched locally; push of 60k+ route files blocked by channel — apply via `apply_master_p0.py` |
| 0.3 Apply p0.diff as normal code | **OPEN** | Diff exists; not yet merged into `vector-store.ts` on main |
| 0.3 Delete hotfix scripts after apply | **DEFERRED** | Keep until whenReady is in tree |
| 0.4 lint/test green | **BLOCKED** | Needs whenReady in VectorStore |
| 0.5 smoke curl | **BLOCKED** | Needs 0.2 |
| server fail-closed embedding space | **DONE** | `isSpaceMismatch` in server.ts |

## Unblock (one path)

```bash
git pull
# Preferred: GitHub Actions → "Apply P0 and push if green"
# Or local:
git apply --check patches/vector-store.p0.diff && git apply patches/vector-store.p0.diff
python3 scripts/apply_master_p0.py
pnpm --filter @eidos/core build
pnpm --filter @eidos/api exec tsc --noEmit
pnpm test
```

## Definition of Phase 0 closed

- [ ] `grep whenReady apps/api/src/services/vector-store.ts` shows implementation
- [ ] `pnpm --filter @eidos/api exec tsc --noEmit` green
- [ ] `pnpm test` green including p0-registry-restart
- [ ] smoke: /v1/health, /v1/search, /v1/catalog/stats
- [ ] hotfix scripts removed only after above

## Next phase

Phase 1 (WAL/checkpoint durability) starts only after Phase 0 DoD is green.
