# Product landing

Source: [`landing/`](../landing/) · config: [`netlify.toml`](../netlify.toml)

## Live

| Host | URL |
|------|-----|
| **Vercel (working)** | https://eidos-landing-ppiiyo.vercel.app |
| Studio | https://eidos-demo.vercel.app |

Live search uses **same-origin** `POST /v1/demo/search`. The host rewrites `/v1/*` to the API:

`https://eidos-semantic-ideation-platform.ai.studio/v1/*`

This avoids CORS (`Access-Control-Allow-Origin` on the API is locked to configured origins, default `localhost`).

## Netlify

1. Connect repo `ppiiyo/EIDOS` (or drag `landing/`)
2. Publish directory: **`landing`** (from `netlify.toml`)
3. Deploy — redirects for `/v1/*` apply automatically

One-click: [Deploy to Netlify](https://app.netlify.com/start/deploy?repository=https://github.com/ppiiyo/EIDOS)

If the UI shows `Load failed`, the build is **old** (direct call to Vercel Studio API). Redeploy from latest `main`.

## Local preview

```bash
npx serve landing
# search will fail without a /v1 proxy; use Vercel/Netlify for full demo
```

## Optional: open CORS on your API

Only if you must call the API cross-origin from many preview URLs:

```bash
# .env on the API host
CORS_ORIGIN=https://eidos-landing-ppiiyo.vercel.app,https://eidos-demo.vercel.app,https://YOUR.netlify.app
```

Prefer the rewrite/proxy approach for marketing sites.
