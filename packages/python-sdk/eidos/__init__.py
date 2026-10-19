"""EIDOS Python SDK — Semantic recommendation engine client."""
from __future__ import annotations
import httpx
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class Recommendation(BaseModel):
    id: str
    score: float
    explanation: Optional[str] = None
    features: Optional[Dict[str, Any]] = None


class EidosClient:
    """Production client for EIDOS semantic recommender."""

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
        item_id: str,
        limit: int = 10,
        min_similarity: float = 0.35,
        diversity_factor: float = 0.7,
    ) -> List[Recommendation]:
        r = self.client.post(
            "/v1/recommend",
            json={
                "item_id": item_id,
                "limit": limit,
                "min_similarity": min_similarity,
                "diversity_factor": diversity_factor,
            },
        )
        r.raise_for_status()
        return [Recommendation(**item) for item in r.json()["recommendations"]]

    def search(
        self,
        query: str,
        limit: int = 10,
        mode: str = "hybrid",
    ) -> List[Recommendation]:
        r = self.client.post(
            "/v1/search",
            json={
                "query": query,
                "limit": limit,
                "mode": mode,
            },
        )
        r.raise_for_status()
        return [Recommendation(**item) for item in r.json()["results"]]

    def close(self):
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


__all__ = ["EidosClient", "Recommendation"]
