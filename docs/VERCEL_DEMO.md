# EIDOS Studio on Vercel

Vercel hosts the **Studio SPA only**. The search API stays on a long-running host (Docker / VPS / current demo).

## Why not full API on Vercel

HNSW + WAL need a persistent process and disk. Serverless cold starts drop the in-memory index.

## Setup

1. Install **Vercel GitHub integration** for `ppiiyo/EIDOS` (Vercel Dashboard → Project → Settings → Git).
2. Project settings (or `vercel.json` in repo):
   - Install: `corepack enable && pnpm install --frozen-lockfile`
   - Build: `pnpm --filter @eidos/core build && pnpm --filter @eidos/workspace build`
   - Output: `dist`
3. Optional env:
   - `VITE_EIDOS_PUBLIC_DEMO_KEY` — public demo key for read-only demo routes
4. `vercel.json` rewrites `/v1/*` to the API host (default: `eidos-semantic-ideation-platform.ai.studio`).

## Project already created

- Vercel project: `eidos-demo` (`prj_5xV92fSiHiaQhTYoQPl2I5wUERBK`)
- After Git link: deploy from `main`.

## Local preview

```bash
pnpm --filter @eidos/core build && pnpm --filter @eidos/workspace build
npx serve dist
```
