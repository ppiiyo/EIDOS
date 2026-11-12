# EIDOS Production Retrieval Benchmark Report

Config: repeats=30, warmup=3, recall=hybrid vs brute-force cosine@10

| Scale (SKU) | Build (ms) | p50 (ms) | p95 (ms) | p99 (ms) | RPS | Recall@10 (hybrid) | RSS (MB) |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | 2260 | 2.77 | 5.53 | 7.11 | 324 | 36.7% | 281.99 |
| 10,000 | 63185 | 5.24 | 10.54 | 15.26 | 164 | 72.5% | 446.87 |

## Acceptance (EIDOS-101/102)
- p95 ≤ 30 ms at 50k SKU
- p95 ≤ 50 ms at 100k SKU
- recall@10 (hybrid vs brute) ≥ 0.95
