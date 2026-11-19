# Product landing

Source: [`landing/`](../landing/)

## Live

| Host | URL |
|------|-----|
| **Vercel** | https://eidos-landing-ppiiyo.vercel.app |
| Studio | https://eidos-demo.vercel.app |

Live search uses **same-origin** `POST /v1/demo/search`. The host rewrites `/v1/*` to the API:

`https://eidos-semantic-ideation-platform.ai.studio/v1/*`

This avoids CORS (`Access-Control-Allow-Origin` on the API is locked to configured origins, default `localhost`).

## Local preview

```bash
npx serve landing
# search needs a /v1 proxy; use the Vercel landing for the full demo
```

## Optional: open CORS on your API

Only if you must call the API cross-origin from preview URLs:

```bash
# .env on the API host
CORS_ORIGIN=https://eidos-landing-ppiiyo.vercel.app,https://eidos-demo.vercel.app
```

Prefer the rewrite/proxy approach for marketing sites.
