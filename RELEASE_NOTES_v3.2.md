# EIDOS v3.2.0 GA — Enterprise Release Notes

**Release Date**: October 2026  
**Status**: General Availability (Production-Ready)

---

## Executive Summary

**EIDOS v3.2.0** transitions the platform from a single-node hybrid vector search & adaptive recommendation engine to a **cloud-native, horizontally scalable, high-availability distributed cluster** with real-time event streaming, enterprise e-commerce connectors, cross-language SDKs, and interactive cluster operations in the Workspace Studio.

---

## Key Highlights in v3.2.0

### 1. Distributed Sharding, Consistent Hash Ring & Automatic Replica Failover
- **ConsistentHashRing (`packages/core/src/cluster/hash-ring.ts`)**: Deterministic FNV-1a 32-bit hash ring with 150 virtual nodes (`vnodes`) per physical shard and configurable replication factor (`R = 2`). Adding or removing shards remaps $< \frac{1}{N} + 0.05$ of keys with zero global re-indexing.
- **ShardRouter (`apps/api/src/services/shard-router.ts`)**: Parallel scatter-gather routing with automatic replica fallback (`isFailover: true`), exponential backoff retries, and single-shard targeted routing.
- **ClusterStateCoordinator (`apps/api/src/services/cluster-coordinator.ts`)**: Distributed heartbeat tracking (`HEARTBEAT_INTERVAL_MS = 2000`, `DEGRADED_TIMEOUT_MS = 6000`), split-brain leader election, and graceful node drain (`POST /v1/cluster/drain`) linked directly to `/v1/health/ready` for zero-dropped-request Kubernetes rolling updates.

### 2. Real-Time Catalog Streaming & Cluster Cache Invalidation
- **KafkaCatalogConsumer (`packages/connectors/src/kafka-consumer.ts`)**: High-throughput event-driven consumer (`eidos.catalog.events`) with micro-batching (`batchSize = 100`, `flushIntervalMs = 500`), exponential retry backoff, and Dead-Letter Queue (`eidos.catalog.dlq`) routing for malformed payloads.
- **BitrixCatalogSync (`packages/connectors/src/bitrix-sync.ts`)**: Enterprise 1C-Bitrix CommerceML XML parser (`<Товар>`, `<Ид>`, `<Наименование>`, `<Описание>`, `<Цены>`) and real-time webhook handler (`ONCRMPRODUCTUPDATE`, `ONCRMPRODUCTADD`, `ONCRMPRODUCTDELETE`) with HMAC signature verification.
- **ClusterInvalidationBus (`apps/api/src/services/invalidation-bus.ts`)**: Pub/Sub invalidation bus that purges local L1 LRU + L2 Redis semantic caches across all cluster nodes within `< 5ms` of catalog mutations.

### 3. Workspace Studio v3.2 UX Upgrades
- **Interactive Cluster Topology & Failover Inspector**: Live visualization of the Consistent Hash Ring (150 vnodes), primary/replica shard states (`healthy`, `degraded`, `draining`, `offline`), and 1-click chaos engineering controls to simulate shard degradation and graceful node draining directly in the browser.
- **1-Click Custom JSON Catalog Importer & Multi-Language SDK Code Generator**: Upload or paste custom JSON product/document catalogs or load industry presets, and export live, ready-to-run integration snippets for **TypeScript (`@eidos/sdk`)**, **Python (`eidos_sdk`)**, and **cURL** pre-populated with active search mode, MMR $\lambda$, and business boost parameters.

### 4. Cloud-Native Packaging & Multi-Language SDKs
- **Helm Chart (`deploy/helm/eidos-engine/`)**: Production Kubernetes manifests including `Deployment`, `Service`, `HorizontalPodAutoscaler` (CPU 70% + custom RPS metrics, 2–10 replicas), and `PodDisruptionBudget` (`minAvailable: 1`).
- **Official Python SDK (`packages/python-sdk/eidos_sdk/`)**: Typed synchronous (`EidosClient`) and asynchronous (`AsyncEidosClient`) Python client with Pydantic-style dataclasses (`SearchResult`, `RecommendResult`, `CatalogItem`, `ClusterStatus`).

---

## Verified SLA & Quality Gates
- **Hybrid Search + Cross-Encoder Rerank SLA**: `< 15ms` p99 on 10,000 documents (`384-d` embeddings).
- **LinUCB Contextual Bandit Update SLA**: `< 2ms` p99 per feedback event via rank-1 Cholesky update.
- **Replica Failover SLA**: `0%` failed requests during primary shard degradation.
- **Test Suite**: 85 test suites (345+ unit, integration, chaos, security, and benchmark assertions) passing.
