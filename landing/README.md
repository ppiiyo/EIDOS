# EIDOS product landing

Static marketing page with live demo search (calls `https://eidos-demo.vercel.app/v1/demo/search`).

## Deploy

**Netlify (recommended for landing):**

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/ppiiyo/EIDOS)

Repo root `netlify.toml` sets `publish = "landing"`.

```bash
npx netlify deploy --dir=landing --prod
```

**Any static host:** upload `landing/` as the site root.

Studio UI stays on Vercel; search API on the long-running host.
