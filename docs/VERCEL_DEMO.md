# EIDOS Studio on Vercel

**Live (preview):** https://eidos-demo-git-main-ppiiyo.vercel.app  
**Production domain:** https://eidos-demo.vercel.app

Vercel hosts the **Studio SPA only**. Search API stays on a long-running host; `/v1/*` is rewritten to that host.

## Architecture

```
Browser → eidos-demo.vercel.app (SPA + assets)
       → /v1/* rewrite → eidos-semantic-ideation-platform.ai.studio
```

## Project settings

| Setting | Value |
|---------|--------|
| Framework | Vite |
| Install | `corepack enable && corepack prepare pnpm@9.15.4 --activate && pnpm install --frozen-lockfile` |
| Build | `pnpm --filter @eidos/core build && pnpm --filter @eidos/workspace build` |
| Output | `dist` |
| Production branch | `main` |

Config also in repo root `vercel.json`.

## Why not full API on Vercel

HNSW + WAL need a persistent process and disk. Serverless cold starts drop the in-memory index.

## Optional env

- `VITE_EIDOS_PUBLIC_DEMO_KEY` — public demo key for read-only demo routes

## Verify

```bash
curl -s https://eidos-demo-git-main-ppiiyo.vercel.app/v1/ready | head
curl -s -X POST https://eidos-demo-git-main-ppiiyo.vercel.app/v1/demo/search \
  -H 'Content-Type: application/json' -d '{"query":"наушники","topK":3}'
```
