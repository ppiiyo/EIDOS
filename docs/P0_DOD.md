# P0 DoD checklist

```bash
# 1. whenReady exists (implementation, not just call site)
grep -c whenReady apps/api/src/services/vector-store.ts   # ≥2

# 2. wasEmptyBeforeRestore ONLY inside loadSnapshotFromDisk
grep -n wasEmptyBeforeRestore apps/api/src/services/vector-store.ts
# must sit after "async loadSnapshotFromDisk" and before that method returns

# 3. await whenReady on request path
grep -rn "whenReady" apps/api/src/routes/search.ts apps/api/src/routes/catalog.ts

# 4. no fabricated 1048 in functional UI code
grep -n 1048 apps/workspace/src/pages/AdminConsolePage/EidosAdminConsole.tsx || true

# 5. runtime data not tracked
git ls-files data/ | wc -l   # 0

# 6. typecheck (explicit filters — not bare pnpm -r exec)
pnpm --filter @eidos/core exec tsc --noEmit
pnpm --filter @eidos/api exec tsc --noEmit
pnpm --filter @eidos/sdk exec tsc --noEmit

# 7. registry-path AC + freshness
pnpm test -- p0-registry-restart

# 8. apply path is single-canonical
# scripts/apply_master_p0.py → git apply patches/vector-store.p0.diff first
```

## Unblock red main (preferred)

GitHub → Actions → **Apply P0 and push if green** → Run workflow

Or local:
```bash
git apply --check patches/vector-store.p0.diff && git apply patches/vector-store.p0.diff
python3 scripts/apply_master_p0.py
# then DoD commands above
```
