# 🚀 EIDOS v3.0 Load Testing Report

**Date:** 2026-10-24  
**Version:** v3.0.0 (with Redis Caching Layer, `SingleFlight` Coalescing & L1 `LRUQueryCache`)  
**Public Demo API Key Used:** `eidos_demo_key_2026_public` (`eidos_demo_key` also supported)  
**Environment:** Local Container Runtime (Node.js v22, 5,005 384-d Indexed Catalog Items across 9 Categories)

---

## 📊 Executive Summary (All 4 Load Test Scenarios)

| Scenario | Requests | Throughput (QPS) | Latency P50 | Latency P95 | Latency P99 | Cache Hit Rate | Error Rate | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Baseline Test (Cold → Warm)** | 500 | **205.4 → 448.0 QPS** | **71.4 → 42.3ms** | **92.3ms** | **122.2ms** | **72.6% → 95.4%** | **0.00%** | ✅ PASS |
| **2. Stress Test (High Concurrency)** | 800 | **768.1 → 901.8 QPS** | **58.0ms** | **112.8ms** | **144.9ms** | **100.0%** | **0.00%** | ✅ PASS |
| **3. Spike Test (SingleFlight Surge)** | 600 | **881.9 → 1049.2 QPS** | **74.1ms** | **125.6ms** | **130.8ms** | **93.0% → 100.0%** | **0.00%** | ✅ PASS |
| **4. Soak Test (80% Warm / 20% Cold)** | 500 | **347.7 → 421.2 QPS** | **70.2ms** | **139.2ms** | **175.5ms** | **73.4% → 80.6%** | **0.00%** | ✅ PASS |

---

## 🧪 Detailed Scenario Breakdown

### 1. Baseline Test (`load-testing/scripts/baseline.js` → `results/baseline.json`)

- **Workload:** 70% Hybrid Search (`POST /v1/search`), 30% Personalized Recommendations (`POST /v1/recommend`)
- **Query Distribution:** 80% top-20 popular e-commerce queries (Zipf distribution), 20% 80 long-tail product queries
- **Measured Results:**
  - **Total Requests:** `500`
  - **Throughput:** `448.01 req/s` (warm) / `205.40 req/s` (cold boot)
  - **Overall Latency (Warm):** Min `14.88ms` | P50 `42.28ms` | P90 `85.43ms` | P95 `92.34ms` | P99 `122.21ms` | Max `150.82ms`
  - **Search Latency (`/v1/search`):** Avg `51.12ms` | P50 `42.36ms` | P95 `92.24ms` | P99 `122.21ms`
  - **Recommend Latency (`/v1/recommend`):** Avg `49.01ms` | P50 `41.71ms` | P95 `95.53ms` | P99 `102.81ms`
  - **Cache Hit Rate:** `95.40%` (`477` HITs / `23` MISSes) — `72.60%` on cold-cache run (`363` HITs / `137` MISSes)
  - **Error Rate:** `0.00%` (`0` errors out of `500` requests)

### 2. Stress Test (`load-testing/scripts/stress.js` → `results/stress.json`)

- **Workload:** High-concurrency search saturation across popular catalog queries
- **Thresholds:** `p(99) < 1000ms`, `errors < 5%`
- **Measured Results:**
  - **Total Requests:** `800`
  - **Throughput:** `901.79 req/s` (warm) / `768.06 req/s` (cold)
  - **Latency:** Min `22.03ms` | P50 `57.96ms` | P90 `97.52ms` | P95 `112.76ms` | P99 `144.93ms` | Max `149.91ms`
  - **Cache Hit Rate:** `100.00%`
  - **Error Rate:** `0.00%`

### 3. Spike Test (`load-testing/scripts/spike.js` → `results/spike.json`)

- **Workload:** Sudden concurrency surge targeting 5 hot queries (`iphone`, `airpods`, `macbook`, `ipad`, `apple watch`)
- **SingleFlight Verification:** Concurrent cache misses for the same hot query share a single in-flight HNSW + BM25+ computation instead of triggering a thundering herd.
- **Measured Results:**
  - **Total Requests:** `600`
  - **Throughput:** `1049.17 req/s` (warm) / `881.90 req/s` (cold spike)
  - **Latency:** Min `25.88ms` | P50 `74.06ms` | P90 `100.07ms` | P95 `125.55ms` | P99 `130.77ms` | Max `134.68ms`
  - **Cache Hit Rate:** `93.00%` on cold spike (`558` HITs / `42` MISSes) → `100.00%` warm
  - **Error Rate:** `0.00%`

### 4. Soak & Eviction Test (`load-testing/scripts/soak.js` → `results/soak.json`)

- **Workload:** 80% cached popular queries + 20% unique cold queries (`unique_query_<idx>_<timestamp>`)
- **Memory & Eviction Verification:**
  - In-memory fallback cache (`MAX_FALLBACK_SIZE = 1000`) and `LRUQueryCache` automatically evict oldest entries when full and purge expired keys every 60s (`unref()` timer).
  - Cache-poisoning guardrails (`isCacheKeySafe` and `isResponseCacheable`) reject oversized responses (`>1MB`) and empty search results (`results.length === 0`).
- **Measured Results:**
  - **Total Requests:** `500`
  - **Throughput:** `421.20 req/s` (warm) / `347.70 req/s` (cold)
  - **Latency:** Min `17.57ms` | P50 `70.19ms` | P90 `118.53ms` | P95 `139.15ms` | P99 `175.52ms` | Max `184.67ms`
  - **Cache Hit Rate:** `80.60%` (`403` HITs / `97` intentional unique cold queries)
  - **Error Rate:** `0.00%`

---

## 🛠️ Reproducing the Load Tests

```bash
# 1. Run all 4 scenarios (Baseline, Stress, Spike, Soak) and analyze results
node load-testing/scripts/run-baseline.mjs
./load-testing/scripts/analyze-results.sh

# 2. Or run individual k6 scripts
k6 run load-testing/scripts/baseline.js
k6 run load-testing/scripts/stress.js
k6 run load-testing/scripts/spike.js
k6 run load-testing/scripts/soak.js

# 3. Launch Prometheus + Grafana + Exporters monitoring stack
cd load-testing/monitoring && docker-compose up -d
```
