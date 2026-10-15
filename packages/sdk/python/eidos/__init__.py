import requests
import time
from typing import List, Dict, Optional, Any
from dataclasses import dataclass

@dataclass
class Recommendation:
    id: str
    score: float
    features: Optional[Dict[str, Any]] = None

class EidosClient:
    """Python SDK for EIDOS Semantic Recommendation Engine."""

    def __init__(
        self,
        base_url: str = "http://localhost:8080",
        api_key: Optional[str] = None,
        timeout: int = 30
    ):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.timeout = timeout
        self.session = requests.Session()

        if api_key:
            self.session.headers['x-api-key'] = api_key
        self.session.headers['Content-Type'] = 'application/json'

    def recommend(
        self,
        item_id: str,
        limit: int = 10,
        min_similarity: float = 0.35,
        diversity_factor: float = 0.7
    ) -> List[Recommendation]:
        """Get recommendations based on item similarity and diversity."""
        response = self.session.post(
            f"{self.base_url}/v1/recommend",
            json={
                "item_id": item_id,
                "limit": limit,
                "min_similarity": min_similarity,
                "diversity_factor": diversity_factor
            },
            timeout=self.timeout
        )
        response.raise_for_status()

        data = response.json()
        recommendations = data.get('recommendations', [])
        return [
            Recommendation(
                id=r['id'],
                score=r['score'],
                features=r.get('features')
            )
            for r in recommendations
        ]

    def recommend_user(
        self,
        user_id: str,
        history: List[str],
        limit: int = 10
    ) -> List[Recommendation]:
        """Get personalized neural recommendations for user based on interaction history."""
        response = self.session.post(
            f"{self.base_url}/v1/recommend/user",
            json={
                "user_id": user_id,
                "history": history,
                "limit": limit
            },
            timeout=self.timeout
        )
        response.raise_for_status()

        data = response.json()
        recommendations = data.get('recommendations', [])
        return [
            Recommendation(id=r['id'], score=r['score'], features=r.get('features'))
            for r in recommendations
        ]

    def search(
        self,
        query: str,
        limit: int = 10,
        min_similarity: float = 0.35
    ) -> List[Recommendation]:
        """Semantic search by natural language text query."""
        response = self.session.post(
            f"{self.base_url}/v1/search",
            json={
                "query": query,
                "limit": limit,
                "min_similarity": min_similarity
            },
            timeout=self.timeout
        )
        response.raise_for_status()

        data = response.json()
        results = data.get('results', [])
        return [
            Recommendation(id=r['id'], score=r['score'], features=r.get('features'))
            for r in results
        ]

    def feedback(
        self,
        user_id: str,
        item_id: str,
        event_type: str = "click",
        timestamp: Optional[int] = None
    ) -> bool:
        """Send user interaction feedback for contextual online learning (LinUCB)."""
        if timestamp is None:
            timestamp = int(time.time() * 1000)

        response = self.session.post(
            f"{self.base_url}/v1/feedback",
            json={
                "userId": user_id,
                "itemId": item_id,
                "eventType": event_type,
                "timestamp": timestamp
            },
            timeout=self.timeout
        )
        response.raise_for_status()
        return True

__all__ = ["EidosClient", "Recommendation"]
