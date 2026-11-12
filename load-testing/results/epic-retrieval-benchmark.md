# EIDOS Production Retrieval Benchmark Report

Config: repeats=30, warmup=3, recall=hybrid vs brute-force cosine@10

| Scale (SKU) | Build (ms) | p50 (ms) | p95 (ms) | p99 (ms) | RPS | Recall@10 (hybrid) | RSS (MB) |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | 2547 | 3.94 | 6.03 | 8.16 | 253 | 36.7% | 298.21 |
| 10,000 | 68494 | 6.46 | 17.08 | 22.08 | 120 | 72.5% | 445.44 |

## Acceptance (EIDOS-101/102)
- p95 ≤ 30 ms at 50k SKU
- p95 ≤ 50 ms at 100k SKU
- recall@10 (hybrid vs brute) ≥ 0.95
