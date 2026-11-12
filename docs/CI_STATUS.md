# CI status (2026-11-12)

## Required gates

| Job | Command | Notes |
|-----|---------|--------|
| Typecheck | `tsc` core / sdk / api | required |
| Injects | all `scripts/inject_*.py` | must exit 0 |
| Markers | `scripts/verify_injects.sh` | required |
| Full suite | `pnpm test` | required (Node 20 + 22) |
| Coverage | `vitest run --coverage packages/core/src/tests` | core thresholds 65% |
| PHP | lint + autoload | required |
| Build | core + sdk + workspace | required |

## Local verification (this session)

- `tests/unit` → **152/152**
- `apps/api/tests` (excl. epic) → **106/106**
- Acceptance (master, admin, retrieval, post-v34, v34-zero, redis) → **65/65**
- Integration cluster + phase2 → **6/6** (needs full tree: `docs/`, `deploy/`)

## Excluded from default suite

- `apps/api/tests/epic-production-retrieval.test.ts` — long bench; enable with `EIDOS_RUN_BENCH=1`

## Product invariants covered

- Snapshot → WAL + `whenReady`
- Demo tenant ephemeral (does not fill `default`)
- Namespaced cache keys + invalidate on default tenant
- `minScore` from ranking defaults applied
- RBAC demotion, StoreError HTTP names, public `/metrics`
