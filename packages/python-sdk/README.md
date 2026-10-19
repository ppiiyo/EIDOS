# kostra44SIP Python SDK (`kostra44sip-sdk`)

Official Python client for the **kostra44SIP** Semantic Recommender & Hybrid Vector Search Engine.

## Installation

```bash
pip install kostra44sip-sdk
```

## Quick Start

```python
from kostra44sip import KostraClient

with KostraClient(base_url="http://localhost:8080", api_key="your-api-key") as client:
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
