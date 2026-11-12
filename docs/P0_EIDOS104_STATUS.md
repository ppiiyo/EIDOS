# P0 / EIDOS-104 / EIDOS-105 status

## On `main` already

- **store-registry.ts (P0)**: snapshot `await` then WAL inside one `ready` promise; `setReadyPromise` on both `getMetadata` and `createIndex` paths.
- **.gitignore**: `data/` runtime snapshots ignored.
- **CI**: PHP lint + Bitrix autoload (`php-connectors.yml`).
- **Benchmark**: 50k/100k, 30 repeats, hybrid recall@10.

## One-liner to finish remaining local patches

```bash
git pull
python3 scripts/apply_p0_104_105_remaining.py
git add -A && git commit -m "fix(p0,EIDOS-104/105): fail-closed, gate prefers dynamic families, deep page headroom" && git push
```

What the script does:

1. **server.ts** — fail-closed on `EmbeddingSpaceMismatchError` (do not boot on wrong embedding space).
2. **ranking-guardrails.ts** — when `customFamilies` is non-empty (dynamic catalog + tenant), do **not** also merge hardcoded `PRODUCT_CATEGORY_FAMILIES` (EIDOS-104).
3. **vector-store.ts** — deep pagination candidate window `offset+limit+50` (EIDOS-105).

## Optional: full demo families extract

If you want the large constant moved to `packages/core/src/search/demo-product-category-families.ts`, use the local tree under your previous P0 workdir or ask for a follow-up commit.
