#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# EIDOS v4.0 — End-to-End Smoke Verification Script (scripts/smoke.sh)
# Verifies Liveness (/v1/health/live), Readiness (/v1/ready), Demo Status & Seed,
# Hybrid Search (/v1/demo/search), and Storefront Widget (/widget.js).
# ==============================================================================

BASE_URL="${EIDOS_URL:-http://127.0.0.1:${PORT:-3000}}"
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=true
      ;;
    http://*|https://*)
      BASE_URL="${arg%/}"
      ;;
  esac
done

echo "[EIDOS Smoke] Target URL: ${BASE_URL}"

if [ "${DRY_RUN}" = "true" ]; then
  echo "[EIDOS Smoke] --dry-run passed: endpoints configured (/v1/health/live, /v1/ready, /v1/demo/status, /v1/demo/load, /v1/demo/search, /widget.js)"
  exit 0
fi

echo "==> 1. Checking Liveness (/v1/health/live)..."
LIVE_JSON="$(curl -fsS "${BASE_URL}/v1/health/live")"
echo "    ${LIVE_JSON}"

echo "==> 2. Checking Readiness (/v1/ready)..."
READY_JSON="$(curl -fsS "${BASE_URL}/v1/ready")"
echo "    ${READY_JSON}"

echo "==> 3. Checking Demo Status (/v1/demo/status)..."
STATUS_JSON="$(curl -fsS "${BASE_URL}/v1/demo/status")"
echo "    ${STATUS_JSON}"

echo "==> 4. Seeding Demo Catalog (/v1/demo/load)..."
LOAD_JSON="$(curl -fsS -X POST "${BASE_URL}/v1/demo/load" -H "Content-Type: application/json" -d '{"scale":"1000"}')"
echo "    ${LOAD_JSON}"

echo "==> 5. Running Golden Search (/v1/demo/search)..."
SEARCH_JSON="$(curl -fsS -X POST "${BASE_URL}/v1/demo/search" -H "Content-Type: application/json" -d '{"query":"недорогие наушники для бега","limit":3}')"
echo "${SEARCH_JSON}" | grep -q '"results"'

echo "==> 6. Verifying Storefront Widget (/widget.js)..."
WIDGET_JS="$(curl -fsS "${BASE_URL}/widget.js")"
echo "${WIDGET_JS}" | grep -q "EidosSearchWidget"

echo "[EIDOS Smoke] All 6 smoke checks PASSED."
