# Master prompt execution status (P0)

## Already on main (verified)

| Item | Status |
|------|--------|
| store-registry snapshot	oawait	oWAL + setReadyPromise | DONE (ordering) |
| server fail-closed EmbeddingSpaceMismatch | DONE (`439684f`) |
| P0 restart unit test | DONE (`apps/api/tests/p0-snapshot-wal-ordering.test.ts`) |
| gitignore data/ | DONE |
| PHP CI + benchmark harness code | DONE |

## One command to close remaining P0 on a clone

```bash
git pull
python3 scripts/apply_master_p0.py
git add -A
git commit -m "fix(p0): whenReady, purge guard, UI 1048, EIDOS-104 gate, deep page, resolveRequestStore"
git push
pnpm test
```

## What apply_master_p0.py patches

1. **vector-store** — whenReady/setReadyPromise; snapshotIds purge only if canUseFullBinaryRestore; deep page +50
2. **server** — fail-closed (no-op if already applied)
3. **store-registry** — stable eidos-demo path; resolveRequestStore if missing
4. **AdminConsole** — remove fabricated 1048
5. **ranking-guardrails** — custom/dynamic families first (EIDOS-104)
6. **search + catalog** — await whenReady before serving

## Still OPEN after P0 (phases 2–5)

- Bench AC numbers (run harness at 50k/100k)
- Honest total / totalIsApproximate
- Full de-demo of PRODUCT_CATEGORY_FAMILIES out of core
- Bitrix N+1 / Woo dual plugin cleanup
- Docs honesty (no unproven sub-15ms claims)
