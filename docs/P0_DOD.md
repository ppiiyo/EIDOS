# P0–P2 Definition of Done Checklist

```bash
# 1. Zero patch / inject scripts in repository
(! grep -rn "inject_" .github scripts package.json)

# 2. whenReady readiness barrier exists and is awaited on request paths
grep -c whenReady apps/api/src/services/vector-store.ts
grep -rn "whenReady" apps/api/src/routes/search.ts apps/api/src/routes/catalog.ts

# 3. Runtime data directory is not tracked in git
git ls-files data/ | wc -l   # 0

# 4. Workspace typecheck (core -> sdk -> api -> workspace)
pnpm lint

# 5. Full test suite + core coverage gate (≥80% lines, ≥75% branches)
pnpm test
pnpm test:coverage

# 6. Live HTTP smoke verification
bash scripts/smoke.sh
```
