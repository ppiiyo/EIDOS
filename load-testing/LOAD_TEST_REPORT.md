# 🚀 EIDOS v3.4 Load Testing Report

**Date:** 2026-11-15  
**Version:** v3.4.0 (with Redis Caching Layer, SingleFlight Coalescing & L1 LRUQueryCache)  
**Default Dev API Key:** `eidos_dev_key`  
**Environment:** Local Container Runtime (Node.js v22, 1,048 384-d Indexed Demo Catalog Items across 9 Categories)

---

## 📊 Executive Summary

| Scenario | Requests | Throughput (QPS) | Latency P50 | Latency P95 | Latency P99 | Cache Hit Rate | Error Rate | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Baseline Test (100 VU Profile)** | 500 | **379.58 QPS** | **50.35ms** | **105.78ms** | **586.76ms** | **74.8%** | **0.00%** | ✅ PASS |
| **2. Stress Test (High Concurrency)** | 800 | **594.79 QPS** | **85.31ms** | **168.99ms** | **621.88ms** | **100.0%** | **0.00%** | ✅ PASS |
| **3. Spike Test (SingleFlight Surge)** | 600 | **671.33 QPS** | **103.38ms** | **191.71ms** | **326.2ms** | **99.2%** | **0.00%** | ✅ PASS |
| **4. Soak Test (80% Warm / 20% Cold)** | 500 | **512.63 QPS** | **55.8ms** | **101.06ms** | **114.19ms** | **72.2%** | **0.00%** | ✅ PASS |

---

## 🛠️ Reproducing the Load Tests

```bash
# 1. Run all tests locally
pnpm run loadtest:baseline
pnpm run loadtest:stress
pnpm run loadtest:spike
pnpm run loadtest:soak
pnpm run loadtest:analyze

# 2. Start monitoring stack
pnpm run loadtest:setup
```
