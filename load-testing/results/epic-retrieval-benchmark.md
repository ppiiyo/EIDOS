# EIDOS Production Retrieval Benchmark Report

Config: repeats=30, warmup=3, recall=hybrid vs brute-force cosine@10

| Scale (SKU) | Build (ms) | p50 (ms) | p95 (ms) | p99 (ms) | RPS | Recall@10 (hybrid) | RSS (MB) |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | 2767 | 3.9 | 8.9 | 11.4 | 229 | 36.7% | 295.42 |
| 10,000 | 71388 | 8.16 | 15.75 | 21.83 | 109 | 65.0% | 446.96 |

## Acceptance (EIDOS-101/102)
- p95 ≤ 30 ms at 50k SKU
- p95 ≤ 50 ms at 100k SKU
- recall@10 (hybrid vs brute) ≥ 0.95
