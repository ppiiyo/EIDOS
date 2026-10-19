import httpx
from kostra44sip import KostraClient, Recommendation


def test_recommend_and_search():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/recommend":
            return httpx.Response(
                200,
                json={
                    "recommendations": [
                        {
                            "id": "item-2",
                            "score": 0.912,
                            "explanation": "High 384-d semantic affinity",
                            "features": {"category": "Electronics"},
                        }
                    ]
                },
            )
        if request.url.path == "/v1/search":
            return httpx.Response(
                200,
                json={
                    "results": [
                        {
                            "id": "item-7",
                            "score": 0.954,
                            "explanation": "Hybrid RRF match",
                        }
                    ]
                },
            )
        return httpx.Response(404)

    with KostraClient(base_url="http://localhost:8080", api_key="test-key") as client:
        client.client = httpx.Client(
            base_url="http://localhost:8080",
            transport=httpx.MockTransport(handler),
        )
        recs = client.recommend("item-1", limit=5)
        assert len(recs) == 1
        assert isinstance(recs[0], Recommendation)
        assert recs[0].id == "item-2"
        assert recs[0].score == 0.912

        hits = client.search("mechanical keyboard", limit=5, mode="hybrid")
        assert len(hits) == 1
        assert hits[0].id == "item-7"
