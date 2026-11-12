# EIDOS Production Retrieval Benchmark Report

Config: repeats=30, warmup=3, recall=hybrid vs brute-force cosine@10

| Scale (SKU) | Build (ms) | p50 (ms) | p95 (ms) | p99 (ms) | RPS | Recall@10 (hybrid) | RSS (MB) |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | 1625 | 3.87 | 7.11 | 12.64 | 235 | 94.2% | 254.31 |
| 10,000 | 24267 | 10.29 | 20.35 | 66.21 | 76 | 93.3% | 612.38 |

## Acceptance (EIDOS-101/102)
- p95 ≤ 30 ms at 50k SKU
- p95 ≤ 50 ms at 100k SKU
- recall@10 (hybrid vs brute) ≥ 0.95
