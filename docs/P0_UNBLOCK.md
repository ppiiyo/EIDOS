# P0 unblock — main was red

## Problem
Registry called `store.setReadyPromise(ready)` without `VectorStore` defining the method → `tsc` red, runtime TypeError on every store create.

**Rule:** caller and callee in the same commit. Never push caller without callee.

## Fix (one command)
```bash
git pull
python3 scripts/apply_master_p0.py   # injects whenReady + wasEmptyBeforeRestore purge
pnpm -r exec tsc --noEmit
pnpm test
git add -A && git commit -m "fix(p0): VectorStore whenReady + wasEmptyBeforeRestore purge" && git push
```

## Purge semantics
`wasEmptyBeforeRestore = this.items.size === 0` at start of `loadSnapshotFromDisk`.
Reconcile deletions only if `snapshotIds.size >= 100 && wasEmptyBeforeRestore`.
Do **not** use `canUseFullBinaryRestore` (always false on slow path).

## Tests
- `p0-snapshot-wal-ordering.test.ts` — pattern-level order
- `p0-registry-restart.test.ts` — **real** `StoreRegistry.getOrCreateStore` path (AC 200+50	o250)

## CI
`.github/workflows/typecheck.yml` runs `tsc --noEmit` before merge can hide this class of break.
