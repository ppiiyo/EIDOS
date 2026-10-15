# EIDOS Python SDK

Official Python Client for the **EIDOS Semantic Recommendation Engine** (`v2.1.0`).

## Installation

```bash
pip install eidos-client
```

Or install locally from source:

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
    api_key="your-api-key"
)

# 1. Semantic Search
results = client.search(query="ergonomic mechanical keyboard", limit=5)
for r in results:
    print(f"[{r.id}] Score: {r.score:.3f}")

# 2. Item-to-Item Semantic Recommendations
recs = client.recommend(
    item_id="1",
    limit=5,
    min_similarity=0.35,
    diversity_factor=0.7
)
for rec in recs:
    print(f"Recommended: {rec.id} (Score: {rec.score})")

# 3. Personalized User Recommendations
user_recs = client.recommend_user(
    user_id="user_42",
    history=["1", "4", "7"],
    limit=10
)

# 4. Stream User Click/Conversion Feedback for Online Bandit Learning
client.feedback(
    user_id="user_42",
    item_id="1",
    event_type="click"
)
```
