# EIDOS Recommender — Benchmarks & A/B Test Results

## Summary Metrics

| Metric | Baseline (Collaborative) | EIDOS Semantic Engine | Delta |
|---|---|---|---|
| **Recommendation CTR** | 4.2% | **5.6%** | **+33.3%** |
| **Direct Conversion Rate** | 1.8% | **2.2%** | **+22.2%** |
| **Avg. Session Time** | 3m 12s | **4m 28s** | **+39.5%** |
| **New Item CTR (Cold Start)** | 0.8% | **3.1%** | **+287.5%** |
| **Catalog Coverage** | 14.2% (power-law tail neglected) | **91.8%** | **+546%** |
| **Inference Latency** | 120ms (multi-table join) | **< 35ms** (HNSW Vector Index) | **-70.8%** |

## Long-Tail Discovery
Collaborative filtering typically concentrates 80% of recommendations into the top 5% of head items. EIDOS activates the long tail of inventory by discovering high-confidence semantic adjacencies.
