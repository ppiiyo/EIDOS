=== EIDOS Semantic Search & Recommendations for WooCommerce ===
Contributors: eidos
Tags: woocommerce, search, semantic-search, vector-search, recommendations
Requires at least: 6.0
Tested up to: 6.7
Stable tag: 1.0.0
Requires PHP: 8.1
License: MIT
License URI: https://opensource.org/licenses/MIT

Hybrid vector (HNSW) + lexical (BM25) search, product catalog synchronization (including variations), and real-time click telemetry for WooCommerce powered by EIDOS.

== Description ==

EIDOS Semantic Search & Recommendations for WooCommerce replaces standard keyword-only WooCommerce search with EIDOS hybrid vector + BM25 search with Reciprocal Rank Fusion (RRF) and head-category intent gating (`simpleCategoryGate`).

System Requirements:
* PHP >= 8.1 (compatible with 8.0+)
* PHP extensions: `ext-curl`, `ext-mbstring` (includes automatic UTF-8 regex fallback if `ext-mbstring` is disabled)
* WordPress >= 6.0, WooCommerce >= 7.0
* Self-hosted EIDOS server (`v3.4.0+`)

Key Features:
* Separate `ADMIN_KEY` (for catalog sync `/v1/catalog/upsert`) and `SEARCH_KEY` (read-only for `/v1/search`, `/v1/recommend`, `/v1/feedback`).
* Full catalog synchronization (`syncCatalog`) including variable product variations (`parent + variations`, `id = (string) product_id / variation_id`).
* Incremental delta synchronization (`syncDelta`) scheduled via WooCommerce Action Scheduler (`as_schedule_recurring_action`) or `WP-Cron`.
* Seamless `pre_get_posts` and `woocommerce_product_query` interception (`replaceSearch`) with request-storm protection and zero-downtime fallback to native WordPress/WooCommerce search if EIDOS is unreachable.
* Non-blocking click and conversion feedback tracking (`pushFeedback`) via `navigator.sendBeacon` and `/wp-json/eidos/v1/feedback` without exposing API keys in browser JS.

== Installation ==

1. Pack the `packages/connectors/woocommerce` directory into `eidos-woocommerce.zip` and upload it via **Plugins -> Add New -> Upload Plugin** in WordPress Admin.
2. Activate the plugin through the **Plugins** screen in WordPress.
3. Go to **Settings -> EIDOS Search** to configure your EIDOS Server URL, `ADMIN_KEY`, `SEARCH_KEY`, and optional WooCommerce REST API keys.
4. Click **Проверить связь (Check Connection)** and then **Синхронизировать (Synchronize)** to index your catalog.
5. Test storefront search at `/?s=<query>&post_type=product`.

== Changelog ==

= 1.0.0 =
* Production-ready pilot release implementing EIDOS Connector Contract v1.0 with full 1C-Bitrix parity (`ADMIN_KEY` / `SEARCH_KEY` separation, `simpleCategoryGate` pass-through, request-storm fallback protection, Action Scheduler delta sync, and `ext-mbstring` safe UTF-8 fallback).
