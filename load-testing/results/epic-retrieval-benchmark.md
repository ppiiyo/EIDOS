# EIDOS Production Retrieval Benchmark Report

Config: repeats=30, warmup=3, recall=hybrid vs brute-force cosine@10

| Scale (SKU) | Build (ms) | p50 (ms) | p95 (ms) | p99 (ms) | RPS | Recall@10 (hybrid) | RSS (MB) |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | 1355 | 2.21 | 3.16 | 5.05 | 465 | 36.7% | 288.16 |
| 10,000 | 39559 | 4.29 | 11.01 | 15.46 | 197 | 65.8% | 546.02 |

## Acceptance (EIDOS-101/102)
- p95 ≤ 30 ms at 50k SKU
- p95 ≤ 50 ms at 100k SKU
- recall@10 (hybrid vs brute) ≥ 0.95
