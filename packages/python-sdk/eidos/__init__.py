"""EIDOS Python SDK — Production Semantic Recommendation & Hybrid Search Client."""
from __future__ import annotations
import httpx
from typing import List, Dict, Optional, Any, Literal
from pydantic import BaseModel


class Recommendation(BaseModel):
    id: str
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    score: float
    explanation: Optional[str] = None
    features: Optional[Dict[str, Any]] = None


class RecommendFilters(BaseModel):
    category: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    exclude_ids: Optional[List[str]] = None


class EidosClient:
    """Synchronous production client for the EIDOS Semantic Recommender API."""

    def __init__(
        self,
        base_url: str = "http://localhost:8080",
        api_key: Optional[str] = None,
        timeout: float = 5.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.Client(
            base_url=self.base_url,
            headers={"x-api-key": api_key or "", "Accept": "application/json"},
            timeout=timeout,
        )

    def recommend(
        self,
        item_id: Optional[str] = None,
        user_id: Optional[str] = None,
        history: Optional[List[str]] = None,
        strategy: Literal["simple", "adaptive", "user"] = "adaptive",
        limit: int = 10,
        min_similarity: float = 0.35,
        diversity_factor: float = 0.7,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Recommendation]:
        payload: Dict[str, Any] = {
            "strategy": strategy,
            "limit": limit,
            "minSimilarity": min_similarity,
            "diversity_factor": diversity_factor,
        }
        if item_id:
            payload["item_id"] = item_id
        if user_id:
            payload["user_id"] = user_id
        if history:
            payload["history"] = history
        if filters:
            payload["filters"] = filters

        r = self.client.post("/v1/recommend", json=payload)
        r.raise_for_status()
        return [Recommendation(**item) for item in r.json()["recommendations"]]

    def search(
        self,
        query: str,
        limit: int = 10,
        mode: Literal["dense", "sparse", "hybrid"] = "hybrid",
        alpha: float = 0.5,
        filter_category: Optional[str] = None,
    ) -> List[Recommendation]:
        payload: Dict[str, Any] = {
            "query": query,
            "limit": limit,
            "mode": mode,
            "alpha": alpha,
        }
        if filter_category:
            payload["filterCategory"] = filter_category

        r = self.client.post("/v1/search", json=payload)
        r.raise_for_status()
        return [Recommendation(**item) for item in r.json()["results"]]

    def upsert_item(self, item: Dict[str, Any]) -> Dict[str, Any]:
        r = self.client.post("/v1/catalog/upsert", json=item)
        r.raise_for_status()
        return r.json()

    def record_feedback(
        self,
        user_id: str,
        item_id: str,
        event_type: Literal["click", "like", "purchase", "ignore", "dislike"] = "click",
    ) -> Dict[str, Any]:
        r = self.client.post(
            "/v1/feedback",
            json={
                "userId": user_id,
                "itemId": item_id,
                "eventType": event_type,
            },
        )
        r.raise_for_status()
        return r.json()

    def health(self) -> Dict[str, Any]:
        r = self.client.get("/v1/health")
        r.raise_for_status()
        return r.json()

    def close(self):
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


__all__ = ["EidosClient", "Recommendation", "RecommendFilters"]
