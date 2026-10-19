# kostra44SIP Deployment Guide

This guide covers deploying kostra44SIP across development, containerized environments, and cloud infrastructure.

---

## 1. Local Development

### Prerequisites
* Node.js >= 20.0.0
* pnpm >= 9.0.0

```bash
# Clone the repository
git clone https://github.com/ppiiyo/kostra44SIP.git
cd kostra44sip

# Install monorepo dependencies
pnpm install

# Start local development server
pnpm dev
```

The static interactive demo will be available at `http://localhost:3000`.

---

## 2. Docker Container Deployment

A lightweight production Dockerfile is included for container orchestration:

```bash
# Build the API image
docker build -t kostra44sip-api -f apps/api/Dockerfile .

# Run the container with custom port and API key
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e KOSTRA44SIP_API_KEY=your_production_secret_key \
  --name kostra44sip-service \
  kostra44sip-api
```

---

## 3. Cloud Deployment

### Deploying the Demo / Landing to Vercel

```bash
# Deploy landing & demo
cd apps/workspace
vercel --prod
```

Set output directory to `dist` with build command `pnpm build`.

### Deploying the REST API to Railway / Fly.io

Create a `fly.toml` or link via Railway CLI:

```bash
# Fly.io deployment
fly launch --dockerfile apps/api/Dockerfile
fly secrets set KOSTRA44SIP_API_KEY=prod_sk_live_12345
fly deploy
```

---

## Environment Variables

| Variable | Default | Required | Purpose |
| :--- | :--- | :--- | :--- |
| `PORT` | `8080` | No | Internal port for Fastify server |
| `HOST` | `0.0.0.0` | No | Interface binding address |
| `KOSTRA44SIP_API_KEY` | None | Yes in production | Secret token required for Bearer authentication |
| `RATE_LIMIT_MAX`| `1200` | No | Max requests permitted per IP per minute |
| `VECTOR_STORE` | `memory` | No | Vector store adapter (`memory` or `qdrant`) |
| `QDRANT_URL` | None | No | Connection string if using Qdrant |
