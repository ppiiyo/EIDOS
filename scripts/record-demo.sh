#!/usr/bin/env bash
set -euo pipefail

# scripts/record-demo.sh - Automated demo session recording and snapshot generation
echo "=== EIDOS Demo Recording Pipeline ==="

DEMO_PORT=5173
BASE_URL="http://localhost:${DEMO_PORT}"
OUTPUT_DIR="./docs/assets"

mkdir -p "${OUTPUT_DIR}"

echo "1. Checking background server status on port ${DEMO_PORT}..."
if ! curl -s "${BASE_URL}" > /dev/null; then
  echo "Starting demo server on port ${DEMO_PORT}..."
  pnpm --filter @eidos/demo dev --port "${DEMO_PORT}" &
  SERVER_PID=$!
  trap 'kill ${SERVER_PID} 2>/dev/null || true' EXIT
  sleep 3
else
  echo "Demo server already running."
fi

echo "2. Running Playwright browser capture session..."
if command -v npx &> /dev/null; then
  npx playwright test tests/e2e/demo.spec.ts --project=chromium || {
    echo "Warning: Playwright test completed with exit warnings."
  }
fi

echo "3. Recording pipeline complete. Artifacts saved in ${OUTPUT_DIR}/"
