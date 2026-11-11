# EIDOS v3.x → v4.0 Migration Guide

## 1. API Key Prefix Standardization

In v4.0, generated API keys use canonical role prefixes enforced by both `apps/api` and `public/widget.js`:

| Role | v3.x prefix | v4.0 canonical prefix | Allowed in browser (`widget.js`) |
|---|---|---|---|
| `master` | `eidos_master_` | `eidos_mk_` | ❌ Forbidden |
| `admin` | `eidos_admin_` | `eidos_ak_` | ❌ Forbidden |
| `merchandiser` | `eidos_merchandiser_` | `eidos_merch_` | ❌ Forbidden |
| `search` (public) | `eidos_search_` | `eidos_pk_` | ✅ Allowed |

**Backward compatibility:** Existing keys stored in `api_keys.json` continue to work because authentication verifies the SHA-256 hash in `ApiKeyManager`, not the string prefix. However, if you embed a legacy `eidos_search_...` key in `public/widget.js`, both `eidos_pk_` and `eidos_search_` are accepted by the storefront widget.

## 2. Public Demo Key (`EIDOS_PUBLIC_DEMO_KEY`)

Hardcoded fallback demo keys (`eidos_demo_key`, `eidos_public_demo_key`, `eidos_demo_key_2026_public`) have been **removed** and added to the weak-key blacklist.

- To enable `/public-demo`, set `EIDOS_PUBLIC_DEMO_KEY` in `.env` (minimum 24 random characters in production).
- The demo key is strictly isolated to `tenantId = 'demo'` and `index = 'demo'`.

## 3. Upsert & HNSW Snapshot Upgrade

- HNSW leaf-shortcut (`fastInsertLeaf`) has been removed to guarantee full multi-layer graph connectivity.
- After upgrading to v4.0, run a one-time snapshot rebuild (`POST /v1/demo/load` for demo or re-import your YML feed via `POST /v1/admin/yml-sync/run`) so any legacy single-layer nodes are re-indexed across all HNSW layers.
