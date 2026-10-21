"""EIDOS Python SDK — End-to-End E-Commerce Personalization Quickstart."""
from eidos import EidosClient


def run_demo():
    with EidosClient(base_url="http://localhost:8080", api_key="eidos_dev_key") as client:
        # 1. Verify cluster health & diagnostics
        health = client.health()
        print(f"[Health] Status: {health['status']} | Indexed Items: {health['itemsCount']}")

        # 2. Upsert a new cold-start product
        client.upsert_item(
            {
                "id": "sku-900",
                "title": "Quantum Neural Audio Interface",
                "description": "32-bit float USB-C studio audio interface with DSP neural preamps.",
                "category": "Electronics",
                "tags": ["audio", "dsp", "studio", "creator"],
                "price": 299.0,
            }
        )

        # 3. Execute Hybrid Search (BM25 + 384-d HNSW)
        hits = client.search(query="neural studio audio", limit=5, mode="hybrid", alpha=0.6)
        print(f"[Search] Top hit: {hits[0].title} (score={hits[0].score:.4f})")

        # 4. Request Adaptive Recommendations with price filter
        recs = client.recommend(
            item_id="1",
            user_id="user-42",
            history=["2"],
            strategy="adaptive",
            limit=5,
            diversity_factor=0.7,
            filters={"max_price": 100.0},
        )
        for idx, rec in enumerate(recs, 1):
            print(f"  #{idx}: {rec.title} [{rec.category}] — score={rec.score:.4f}")

        # 5. Record online conversion feedback
        fb = client.record_feedback(user_id="user-42", item_id="2", event_type="purchase")
        print(f"[Feedback] Accepted={fb['accepted']} | Stats={fb['stats']}")


if __name__ == "__main__":
    run_demo()
