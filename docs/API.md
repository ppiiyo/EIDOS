# EIDOS Recommender API Documentation

Version: `v1`  
Protocol: `HTTPS`  
Data Format: `JSON`  

---

## Authentication

All REST API requests require an API key passed via the `Authorization` header:

```http
Authorization: Bearer YOUR_API_KEY
```

Requests missing valid credentials will return HTTP `401 Unauthorized`.

---

## Rate Limits

Standard rate limits applied per API key:

| Tier | Request Limit | Burst |
| :--- | :--- | :--- |
| Developer / Sandbox | 60 req/min | 10 req/sec |
| Business Production | 1,200 req/min | 100 req/sec |
| Enterprise Custom | Unlimited / Dedicated Node | Custom |

Response headers include rate limit metadata:
* `X-RateLimit-Limit`: Maximum requests per window
* `X-RateLimit-Remaining`: Remaining requests in current window
* `X-RateLimit-Reset`: UNIX timestamp when limit refreshes

---

## Endpoints

### 1. Health Status

Checks service status, current version, and indexed item counts.

* **Endpoint:** `GET /v1/health`
* **Auth Required:** No

#### Example Request

```bash
curl -X GET "https://api.eidos.dev/v1/health"
```

#### Response (`200 OK`)

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "itemsCount": 104,
  "uptimeSeconds": 86420,
  "model": "all-MiniLM-L6-v2"
}
```

---

### 2. Get Semantic Recommendations

Retrieves semantically proximate items given a source item identifier. Employs cosine similarity over vector embeddings with diversity reranking.

* **Endpoint:** `POST /v1/recommend`
* **Auth Required:** Yes

#### Request Body

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `itemId` | string | Yes | Unique identifier of reference item |
| `limit` | integer | No (Default: 5) | Maximum recommendations to return (1-50) |
| `minSimilarity` | number | No (Default: 0.40) | Cosine similarity cutoff (0.0 to 1.0) |
| `diversityFactor`| number | No (Default: 0.70) | Balance between pure relevance and entropy (0.0 to 1.0) |
| `excludeIds` | string[]| No | IDs to exclude from output |
| `filterCategory` | string | No | Optional category partition filter |

#### Example Request

```bash
curl -X POST "https://api.eidos.dev/v1/recommend" \
  -H "Authorization: Bearer eidos_live_sk94829a8f" \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": "prod-402",
    "limit": 3,
    "minSimilarity": 0.45,
    "diversityFactor": 0.75
  }'
```

#### Response (`200 OK`)

```json
{
  "sourceItemId": "prod-402",
  "recommendations": [
    {
      "id": "prod-118",
      "title": "Ergonomic Mechanical Keyboard with Gateron Yellow Switches",
      "description": "Custom programmable ortholinear board designed for tactile programming comfort.",
      "category": "Electronics",
      "tags": ["ergonomics", "hardware", "typing", "productivity"],
      "price": 189.00,
      "score": 0.8842
    },
    {
      "id": "prod-209",
      "title": "Ultra-Wide Monitor Light Bar with Auto-Dimming",
      "description": "Asymmetric optical design preventing screen glare during late-night code reviews.",
      "category": "Office",
      "tags": ["lighting", "desk-setup", "workspace"],
      "price": 79.50,
      "score": 0.7631
    },
    {
      "id": "prod-085",
      "title": "Solid Walnut Wrist Rest for Compact Tenkeyless Layouts",
      "description": "Hand-sanded American walnut support with non-slip silicone feet.",
      "category": "Accessories",
      "tags": ["ergonomics", "woodwork", "comfort"],
      "price": 34.00,
      "score": 0.7105
    }
  ],
  "latencyMs": 14.8,
  "entropy": 1.5219
}
```

---

### 3. Semantic Natural Language Search

Performs direct vector inference on arbitrary natural language queries to discover conceptual matches, even without exact keyword overlap.

* **Endpoint:** `POST /v1/search`
* **Auth Required:** Yes

#### Request Body

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `query` | string | Yes | Natural language query (1-500 characters) |
| `limit` | integer | No (Default: 10) | Maximum results to return |
| `minSimilarity` | number | No (Default: 0.35) | Cosine threshold filter |
| `filterCategory` | string | No | Optional category restriction |

#### Example Request

```bash
curl -X POST "https://api.eidos.dev/v1/search" \
  -H "Authorization: Bearer eidos_live_sk94829a8f" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "something to reduce eye strain when working late hours",
    "limit": 2
  }'
```

#### Response (`200 OK`)

```json
{
  "query": "something to reduce eye strain when working late hours",
  "results": [
    {
      "id": "prod-209",
      "title": "Ultra-Wide Monitor Light Bar with Auto-Dimming",
      "description": "Asymmetric optical design preventing screen glare during late-night code reviews.",
      "category": "Office",
      "tags": ["lighting", "desk-setup", "workspace"],
      "price": 79.50,
      "score": 0.8124
    },
    {
      "id": "prod-552",
      "title": "Matte Anti-Reflective Screen Filter 27-inch",
      "description": "Polarized blue-light filtering film with 95% clarity retention.",
      "category": "Accessories",
      "tags": ["ergonomics", "screen", "blue-light"],
      "price": 45.00,
      "score": 0.7716
    }
  ],
  "latencyMs": 18.2
}
```

---

### 4. Catalog Ingestion & Embedding Generation

Uploads new products or records into the vector index. When embeddings are omitted, the server automatically computes 384-dimensional vectors using the underlying transformer pipeline.

* **Endpoint:** `POST /v1/catalog`
* **Auth Required:** Yes

#### Request Body

```json
{
  "items": [
    {
      "id": "prod-901",
      "title": "Noise-Cancelling Overhead Headphones",
      "description": "Active hybrid ANC with 40-hour battery life and spatial audio calibration.",
      "category": "Audio",
      "tags": ["wireless", "anc", "music", "focus"],
      "price": 249.99
    }
  ]
}
```

#### Response (`201 Created`)

```json
{
  "success": true,
  "indexedCount": 1,
  "durationMs": 42.6
}
```

---

## Error Handling

Standard HTTP error format adheres to RFC 7807 problem details:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed: 'itemId' is required and must be a string",
  "timestamp": "2026-09-18T22:30:00Z"
}
```

| HTTP Status | Meaning | Recovery Action |
| :--- | :--- | :--- |
| `400 Bad Request` | Invalid payload or missing required fields | Check request JSON against schema |
| `401 Unauthorized` | Invalid or missing API key | Verify `Authorization: Bearer <key>` |
| `404 Not Found` | Requested `itemId` does not exist in catalog | Confirm item ID is ingested |
| `429 Too Many Requests`| Rate limit exceeded | Respect `Retry-After` header |
| `500 Server Error` | Unhandled runtime failure | Check status page or retry with exponential backoff |

---

## SDK Code Examples

### Python

```python
import requests

API_KEY = "eidos_live_sk94829a8f"
BASE_URL = "https://api.eidos.dev"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

payload = {
    "itemId": "prod-402",
    "limit": 5,
    "diversityFactor": 0.7
}

response = requests.post(f"{BASE_URL}/v1/recommend", json=payload, headers=headers)
recommendations = response.json().get("recommendations", [])

for item in recommendations:
    print(f"[{item['score']:.2f}] {item['title']} - ${item.get('price', 0)}")
```

### Node.js / TypeScript (with `@eidos/sdk`)

```typescript
import { EidosClient } from '@eidos/sdk';

const client = new EidosClient({
  baseUrl: 'https://api.eidos.dev',
  apiKey: process.env.EIDOS_API_KEY!,
});

async function main() {
  const res = await client.recommend({
    itemId: 'prod-402',
    limit: 5,
    diversityFactor: 0.75,
  });

  console.log(`Retrieved ${res.recommendations.length} recommendations in ${res.latencyMs}ms:`);
  for (const item of res.recommendations) {
    console.log(`- [${item.score.toFixed(2)}] ${item.title}`);
  }
}

main().catch(console.error);
```

### Go

```go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type RecommendRequest struct {
	ItemId          string  `json:"itemId"`
	Limit           int     `json:"limit"`
	DiversityFactor float64 `json:"diversityFactor"`
}

func main() {
	reqBody, _ := json.Marshal(RecommendRequest{
		ItemId:          "prod-402",
		Limit:           5,
		DiversityFactor: 0.7,
	})

	req, _ := http.NewRequest("POST", "https://api.eidos.dev/v1/recommend", bytes.NewBuffer(reqBody))
	req.Header.Set("Authorization", "Bearer eidos_live_sk94829a8f")
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Println(string(body))
}
```
