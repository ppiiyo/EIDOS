# EIDOS v3.2 — Distributed HNSW Cluster Deployment Guide

This guide walks through deploying a multi-node EIDOS v3.2 Distributed HNSW Cluster using **Docker Compose** or **Kubernetes** with LSH Hyperplane Routing, Consistent Hashing, Reciprocal Rank Fusion (RRF), and automatic replica failover.

---

## 1. Architecture Overview

- **Coordinator Node (`ROLE=coordinator`)**:
  - Receives client requests (`/v1/search`, `/v1/recommend`, `/v1/catalog/upsert`).
  - Uses `LSHShardRouter` (Consistent Hash Ring + Hyperplane LSH Signatures) to route writes and multi-probe scatter-gather reads across shards.
  - Merges top-K results using `DistributedResultMerger` (RRF + MMR diversification).
  - Performs continuous shard health checks, automatic leader election, and transparent failover to healthy replicas when a shard goes down.
- **Shard Nodes (`SHARD_ID=0..N-1`)**:
  - Maintain partitioned in-memory quantized HNSW graphs and WAL persistence.
  - Store secondary replica partitions (`replicationFactor >= 2`) to guarantee **zero data loss** during single-node failures.

---

## 2. Option A: Docker Compose Deployment (3 Shards + Coordinator)

### Launch the Cluster

```bash
docker-compose -f deploy/docker-compose.cluster.yml up -d
```

### Verify Cluster Health

```bash
curl -s http://localhost:3000/v1/health | jq .
curl -s http://localhost:3001/v1/health | jq .
curl -s http://localhost:3002/v1/health | jq .
curl -s http://localhost:3003/v1/health | jq .
```

### Run Integration & Failover Verification

```bash
pnpm test tests/integration/cluster.test.ts
pnpm test tests/integration/failover.test.ts
bash scripts/simulate-node-failure.sh
```

---

## 3. Option B: Kubernetes Deployment (StatefulSet + HPA)

### Apply Manifests

```bash
kubectl create namespace eidos
kubectl apply -f deploy/kubernetes/eidos-cluster.yaml
```

### Inspect Rollout Status

```bash
kubectl -n eidos get statefulsets,deployments,pods,svc,hpa
```

---

## 4. Environment Variables Reference

| Variable | Default | Description |
| :--- | :--- | :--- |
| `CLUSTER_MODE` | `false` | Enables distributed HNSW cluster coordination (default OFF for single-node) |
| `ROLE` | `standalone` | Node role: `coordinator`, `shard`, or `standalone` |
| `SHARD_ID` | `0` | Numeric shard identifier (`0`, `1`, `2`, ...) |
| `EIDOS_SHARD_COUNT` | `3` | Total number of shards in the cluster |
| `SHARD_URLS` | — | Comma-separated list of shard HTTP endpoints |
| `COORDINATOR_URL` | — | Internal URL of the cluster coordinator |
