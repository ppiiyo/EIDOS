"""
kostra44SIP Python SDK
Official Python client library for kostra44SIP Semantic Recommender & Vector Search Engine.
Supports zero-dependency standard library urllib, plus requests if installed.
"""

from __future__ import annotations

import json
import time
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Union

@dataclass
class CatalogItemInput:
    id: str
    title: str
    description: str
    category: str
    tags: List[str] = field(default_factory=list)
    price: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

@dataclass
class RecommendationItem:
    id: str
    title: str
    description: str
    category: str
    score: float
    tags: List[str] = field(default_factory=list)
    price: Optional[str] = None
    source: Optional[str] = None
    why_recommended: Optional[str] = None

@dataclass
class SearchResponse:
    query: str
    mode: str
    results: List[RecommendationItem]
    latency_ms: float

class KostraException(Exception):
    """Base exception for kostra44SIP API errors."""
    def __init__(self, message: str, status_code: Optional[int] = None, details: Optional[Any] = None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details

class KostraClient:
    """
    Python Client SDK for kostra44SIP Semantic Recommendation Engine.

    Usage:
        client = KostraClient(base_url="http://localhost:8080", api_key="dev-key-min-32-chars")
        results = client.search("sci-fi space exploration", mode="hybrid")
        recs = client.recommend("1", limit=5)
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8080",
        api_key: Optional[str] = None,
        timeout: int = 30
    ):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.timeout = timeout

    def _request(self, method: str, path: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "kostra44sip-python-sdk/3.0.0",
        }
        if self.api_key:
            headers["x-api-key"] = self.api_key

        data_bytes = json.dumps(payload).encode('utf-8') if payload is not None else None
        req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                resp_bytes = resp.read()
                return json.loads(resp_bytes.decode('utf-8'))
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8')
            try:
                err_json = json.loads(err_body)
                msg = err_json.get('message', err_body)
            except Exception:
                msg = err_body
            raise KostraException(f"kostra44SIP API Error ({e.code}): {msg}", status_code=e.code, details=err_body) from e
        except Exception as e:
            raise KostraException(f"kostra44SIP Connection Error: {str(e)}") from e

    def health(self) -> Dict[str, Any]:
        """Check API service health and vector index statistics."""
        return self._request("GET", "/v1/health")

    def search(
        self,
        query: str,
        limit: int = 10,
        min_similarity: float = 0.25,
        filter_category: Optional[str] = None,
        mode: str = "hybrid",
        alpha: float = 0.5,
    ) -> SearchResponse:
        """
        Unified search with support for Dense (HNSW), Sparse (BM25) or Hybrid (Reciprocal Rank Fusion).
        
        Args:
            query: Natural language search string
            limit: Maximum items to retrieve (default: 10)
            min_similarity: Minimum cosine threshold
            filter_category: Optional category filter
            mode: Search algorithm - "hybrid" (RRF), "dense" (HNSW), or "sparse" (BM25)
            alpha: Balance weight: 0.0 (pure BM25) to 1.0 (pure dense HNSW)
        """
        payload = {
            "query": query,
            "limit": limit,
            "minSimilarity": min_similarity,
            "mode": mode,
            "alpha": alpha,
        }
        if filter_category:
            payload["filterCategory"] = filter_category

        data = self._request("POST", "/v1/search", payload)
        results = [
            RecommendationItem(
                id=str(r.get("id")),
                title=r.get("title", ""),
                description=r.get("description", ""),
                category=r.get("category", ""),
                score=float(r.get("score", 0.0)),
                tags=r.get("tags", []),
                price=r.get("price"),
                source=r.get("source"),
            )
            for r in data.get("results", [])
        ]
        return SearchResponse(
            query=data.get("query", query),
            mode=data.get("mode", mode),
            results=results,
            latency_ms=float(data.get("latencyMs", 0.0)),
        )

    def recommend(
        self,
        item_id: str,
        limit: int = 5,
        min_similarity: float = 0.35,
        diversity_factor: float = 0.7,
        exclude_ids: Optional[List[str]] = None,
        filter_category: Optional[str] = None,
    ) -> List[RecommendationItem]:
        """
        Item-to-item neural recommendations using Maximal Marginal Relevance (MMR).
        """
        payload = {
            "itemId": str(item_id),
            "limit": limit,
            "minSimilarity": min_similarity,
            "diversityFactor": diversity_factor,
        }
        if exclude_ids:
            payload["excludeIds"] = [str(x) for x in exclude_ids]
        if filter_category:
            payload["filterCategory"] = filter_category

        data = self._request("POST", "/v1/recommend", payload)
        return [
            RecommendationItem(
                id=str(r.get("id")),
                title=r.get("title", ""),
                description=r.get("description", ""),
                category=r.get("category", ""),
                score=float(r.get("score", 0.0)),
                tags=r.get("tags", []),
                price=r.get("price"),
                why_recommended=r.get("whyRecommended"),
            )
            for r in data.get("recommendations", [])
        ]

    def recommend_user(
        self,
        user_id: str,
        history: List[str],
        limit: int = 5,
        diversity_factor: float = 0.7,
    ) -> List[RecommendationItem]:
        """
        Multi-interest personalized recommendations using MIND capsule user tower.
        """
        payload = {
            "userId": str(user_id),
            "history": [str(x) for x in history],
            "limit": limit,
            "diversityFactor": diversity_factor,
        }
        data = self._request("POST", "/v1/recommend/user", payload)
        return [
            RecommendationItem(
                id=str(r.get("id")),
                title=r.get("title", ""),
                description=r.get("description", ""),
                category=r.get("category", ""),
                score=float(r.get("score", 0.0)),
                tags=r.get("tags", []),
                price=r.get("price"),
            )
            for r in data.get("recommendations", [])
        ]

    def ingest_item(
        self,
        item_id: str,
        title: str,
        description: str,
        category: str,
        tags: Optional[List[str]] = None,
        price: Optional[str] = None,
        embedding: Optional[List[float]] = None,
    ) -> Dict[str, Any]:
        """Index a single product into the vector catalog and BM25 index."""
        payload: Dict[str, Any] = {
            "id": str(item_id),
            "title": title,
            "description": description,
            "category": category,
            "tags": tags or [],
        }
        if price:
            payload["price"] = price
        if embedding:
            payload["embedding"] = embedding

        return self._request("POST", "/v1/catalog/items", payload)

    def ingest_batch(self, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Batch ingestion for high-throughput product indexing."""
        return self._request("POST", "/v1/catalog/batch", {"items": items})

    def feedback(
        self,
        user_id: str,
        item_id: str,
        event_type: str = "click",
        timestamp: Optional[int] = None,
    ) -> bool:
        """
        Record online interaction feedback to continuously update contextual bandits.
        """
        if timestamp is None:
            timestamp = int(time.time() * 1000)

        self._request(
            "POST",
            "/v1/feedback",
            {
                "userId": str(user_id),
                "itemId": str(item_id),
                "eventType": event_type,
                "timestamp": timestamp,
            },
        )
        return True

__all__ = [
    "KostraClient",
    "KostraException",
    "CatalogItemInput",
    "RecommendationItem",
    "SearchResponse",
]
