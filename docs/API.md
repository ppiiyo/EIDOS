# EIDOS Recommender — REST API Reference

Base URL: `https://api.eidos.ai/v1` (or local `http://localhost:8000/v1`)

## Authentication

Pass your API key in the `Authorization` header:

```http
Authorization: Bearer eidos_live_sk_94a28f731c
```

---

## Endpoints

### 1. Semantic Search
`POST /v1/search`

Find items in the catalog that match the semantic intent of a query, even with zero lexical keywords in common.

#### Request Body
```json
{
  "query": "хочу что-то про симуляцию реальности и восстание машин",
  "limit": 5,
  "threshold": 0.25,
  "explain": true
}
```

#### Response (200 OK)
```json
{
  "status": "success",
  "latency_ms": 4.2,
  "query_embedding_dim": 384,
  "results": [
    {
      "id": 2,
      "title": "Матрица",
      "category": "Фильмы",
      "score": 0.94,
      "confidence": "94%",
      "reason": "Прямое совпадение по семантическим векторам: симуляция, киберпанк, ии"
    },
    {
      "id": 1,
      "title": "Cyberpunk 2077",
      "category": "Игры",
      "score": 0.88,
      "confidence": "88%",
      "reason": "Близкий смысловой кластер: киберпанк, будущее, симуляция"
    }
  ]
}
```

---

### 2. Item-to-Item Recommendations
`POST /v1/recommend`

Get recommendations related to a specific product, video, course, or job.

#### Request Body
```json
{
  "item_id": 1,
  "limit": 4,
  "min_similarity": 0.3,
  "cross_category": true
}
```

#### Response (200 OK)
```json
{
  "status": "success",
  "source_item": {
    "id": 1,
    "title": "Cyberpunk 2077"
  },
  "recommendations": [
    {
      "id": 2,
      "title": "Матрица",
      "category": "Фильмы",
      "similarity": 0.91,
      "reason": "Кросс-категорийная связь: общая тема антиутопии и виртуальности"
    },
    {
      "id": 8,
      "title": "VR-шлем NeuroVision Pro",
      "category": "Гаджеты",
      "similarity": 0.82,
      "reason": "Гаджет погружения в виртуальные миры"
    }
  ]
}
```

---

### 3. Sync Catalog / Upsert Items
`POST /v1/catalog/upsert`

Upload or update catalog items. Embeddings are generated automatically.

#### Request Body
```json
{
  "items": [
    {
      "id": 101,
      "title": "Neuromancer",
      "description": "Классика Уильяма Гибсона о киберпространстве и хакерах",
      "category": "Книги",
      "metadata": { "price": 750, "year": 1984 }
    }
  ]
}
```
