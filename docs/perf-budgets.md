# EIDOS Performance Budgets (`@perf`)

This document records the target hardware, algorithmic complexity, and CI runner budgets for `@perf`-tagged benchmarks in the EIDOS repository.

## 1. Search Latency SLAs (`tests/benchmarks/search-sla.test.ts`)

| Benchmark | Corpus Size | Parameters | Dedicated Hardware Target | Shared 2-vCPU CI Runner Budget |
| --- | --- | --- | --- | --- |
| HNSW ANN Search p99 | 10,000 × 384-d | `M=16, efSearch=24`, Int8 SQ | `< 2.5 ms` | `< 5.0 ms` |
| BM25+ Lexical Search p99 | 10,000 docs | `k1=1.5, b=0.75`, inverted postings | `< 1.5 ms` | `< 3.0 ms` |
| Hybrid RRF + Cross-Encoder Rerank p99 | 10,000 docs | `topK=20 → rerank(25) → 10` | `< 8.0 ms` | `< 15.0 ms` |
| `@perf` Batch Indexing (1,000 docs) | 1,000 × 384-d | Full multi-layer `HNSWIndex.insert` (`M=16, efConstruction=64`) + `BM25Index.addDocument` | `< 500 ms` (Apple M2/M3 or 8-core Xeon) | `< 3,000 ms` (GitHub Actions 2-vCPU shared VM under V8 coverage/multi-worker contention) |

### Justification for `@perf` Batch Indexing Budget (`3,000 ms` on Shared CI)

1. **Honest Public HNSW Graph Construction (`EIDOS-106`)**:
   - Previously, a private bypass (`fastInsertLeaf`) skipped multi-layer graph search (`efConstruction=64`) and heuristic neighbor selection (`selectNeighborsHeuristic`), artificially finishing in `< 200 ms` while degrading graph connectivity (`Recall@10 < 0.35`).
   - Removing `fastInsertLeaf` and using the public `hnsw.insert(id, vector)` API performs true hierarchical greedy search and bidirectional link pruning across `M=16, M0=32, efConstruction=64` for all 1,000 384-dimensional vectors (`~64,000` 384-d inner-product evaluations).
2. **Shared CI Runner Contention**:
   - On a dedicated developer CPU, 1,000 full HNSW insertions + BM25 tokenization complete in `~380–650 ms`.
   - On virtualized 2-vCPU CI runners running parallel Vitest workers, V8 JIT compilation and CPU steal can push wall-clock time to `900–1,800 ms`. Setting the CI gate to `3,000 ms` prevents false-positive flakiness from VM noisy-neighbor scheduling while still catching any $O(N^2)$ regression.
