# P0 Unblock — `whenReady` & Snapshot-Before-WAL Ordering

## Resolution
`StoreRegistry` and `VectorStore` define `setReadyPromise(ready)` and `whenReady()` directly in `apps/api/src/services/vector-store.ts` and `apps/api/src/services/store-registry.ts`.

## Purge Semantics
- `wasEmptyBeforeRestore = this.items.size === 0` is recorded at the start of `loadSnapshotFromDisk`.
- Stale IDs are reconciled only when `snapshotIds.size >= 100 && wasEmptyBeforeRestore`.
- Snapshot restoration uses a synchronous 64 KB chunked reader when a verified `.hnsw.bin` binary graph is present, and falls back to streaming batch re-embedding otherwise.

## Regression Coverage
- `apps/api/tests/p0-snapshot-wal-ordering.test.ts` — snapshot load before WAL replay ordering
- `apps/api/tests/p0-registry-restart.test.ts` — `StoreRegistry.getOrCreateStore` restart persistence (`200 + 50 -> 250`)
- `tests/unit/p0-4-streaming-snapshot-and-wal.test.ts` — streaming snapshot, `.hnsw.bin` SHA-256 verification, and bounded WAL
