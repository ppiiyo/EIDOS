=== EIDOS Semantic Search & Recommendations for WooCommerce ===
Contributors: eidos
Tags: woocommerce, search, semantic-search, vector-search, recommendations
Requires at least: 6.0
Tested up to: 6.7
Stable tag: 1.0.0
Requires PHP: 8.0
License: MIT
License URI: https://opensource.org/licenses/MIT

Hybrid vector (HNSW) + lexical (BM25) search, product catalog synchronization (including variations), and real-time click telemetry for WooCommerce powered by EIDOS.

== Description ==

EIDOS Semantic Search & Recommendations for WooCommerce replaces standard keyword-only WooCommerce search with EIDOS hybrid vector + BM25 search with Reciprocal Rank Fusion (RRF).

Key Features:
* Full catalog synchronization (`syncCatalog`) including variable product variations via `/wp-json/wc/v3/products` and `/variations`.
* Hourly incremental delta synchronization (`syncDelta`) using `modified_after` ISO8601 filtering.
* Seamless `pre_get_posts` search interception (`replaceSearch`) with automatic zero-downtime fallback to native WordPress search if the EIDOS service is unreachable.
* Non-blocking click and conversion feedback tracking (`pushFeedback`) via `navigator.sendBeacon` and `/wp-json/eidos/v1/feedback`.
* Admin settings panel with connection diagnostics (`healthCheck`) and one-click catalog sync.

== Installation ==

1. Upload the `woocommerce` plugin folder to the `/wp-content/plugins/eidos-woocommerce` directory, or install the zip archive through the WordPress Plugins screen directly.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Go to Settings -> EIDOS Search to configure your EIDOS Server URL, API Key, and WooCommerce REST API keys.
4. Click "Check Connection" and then "Synchronize" to index your catalog.

== Changelog ==

= 1.0.0 =
* Initial release implementing EIDOS Connector Contract v1.0 (syncCatalog, syncDelta, replaceSearch, pushFeedback, healthCheck, mapFields).
