# Eidos Python SDK (`eidos-sdk`)

Official Python client for the **Eidos** Semantic Recommender & Hybrid Vector Search Engine.

## Installation

```bash
pip install eidos-sdk
```

## Quick Start

```python
from eidos import EidosClient

with EidosClient(base_url="http://localhost:8080", api_key="your-api-key") as client:
    # 1. Get MMR-diversified item recommendations
    recs = client.recommend(
        item_id="prod-001",
        limit=5,
        min_similarity=0.35,
        diversity_factor=0.7,
    )
    for rec in recs:
        print(rec.id, rec.score, rec.explanation)

    # 2. Execute Hybrid Search (BM25 + 384-d HNSW)
    results = client.search(
        query="mechanical split keyboard",
        limit=10,
        mode="hybrid",
    )
    for hit in results:
        print(hit.id, hit.score)
```
