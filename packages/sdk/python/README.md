# EIDOS Python SDK

Official Python Client for the **EIDOS Semantic Recommendation Engine & Hybrid Vector Search** (`v3.0.0`).

Zero external dependencies required (uses standard library out of the box).

## Installation

```bash
pip install eidos-client
```

Or install locally from the monorepo:

```bash
cd packages/sdk/python
pip install -e .
```

## Quick Start

```python
from eidos import EidosClient

# Initialize client
client = EidosClient(
    base_url="http://localhost:8080",
    api_key="your_production_api_key"
)

# 1. Hybrid Search (Reciprocal Rank Fusion of BM25 sparse + HNSW dense)
res = client.search(
    query="ergonomic mechanical keyboard with blue switches",
    mode="hybrid",     # "hybrid" | "dense" | "sparse"
    alpha=0.6,         # 0.0 = pure BM25 keyword, 1.0 = pure dense vector
    limit=5
)
print(f"Latency: {res.latency_ms}ms, Mode: {res.mode}")
for item in res.results:
    print(f"[{item.id}] {item.title} — score: {item.score:.4f} (via {item.source})")

# 2. Item-to-Item Semantic Recommendations (with Maximal Marginal Relevance)
recs = client.recommend(
    item_id="1",
    limit=5,
    min_similarity=0.25,
    diversity_factor=0.3
)
for rec in recs:
    print(f"Recommended: {rec.title} ({rec.score:.3f})")

# 3. Multi-Interest Personalized Recommendations (MIND User Tower)
user_recs = client.recommend_user(
    user_id="user_42",
    history=["1", "4", "7"],
    limit=5
)

# 4. Stream Feedback to Online Contextual Bandits (LinUCB)
client.feedback(
    user_id="user_42",
    item_id="1",
    event_type="purchase"  # "click" | "purchase" | "like" | "dislike"
)

# 5. Index Products into Vector & BM25 Catalogs
client.ingest_item(
    item_id="prod_101",
    title="Ergonomic Split Keyboard",
    description="Ortholinear columnar layout with hot-swappable tactile switches",
    category="Electronics",
    tags=["ergonomics", "hardware", "typing"],
    price="14 990 ₽"
)
```
