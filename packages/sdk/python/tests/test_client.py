import unittest
from kostra44sip import KostraClient, RecommendationItem, SearchResponse, KostraException

class TestKostraClient(unittest.TestCase):
    def test_client_initialization(self):
        client = KostraClient(base_url="http://localhost:8080", api_key="test-key")
        self.assertEqual(client.base_url, "http://localhost:8080")
        self.assertEqual(client.api_key, "test-key")

    def test_dataclasses(self):
        item = RecommendationItem(
            id="1",
            title="Keyboard",
            description="Tactile",
            category="Hardware",
            score=0.95,
            source="hybrid",
        )
        self.assertEqual(item.id, "1")
        self.assertEqual(item.score, 0.95)

        res = SearchResponse(query="keyboard", mode="hybrid", results=[item], latency_ms=4.2)
        self.assertEqual(len(res.results), 1)
        self.assertEqual(res.results[0].title, "Keyboard")

if __name__ == "__main__":
    unittest.main()
