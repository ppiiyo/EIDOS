#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# EIDOS v4.0 — 15-Minute Pilot Bootstrap Script (deploy/pilot/install.sh)
# ==============================================================================
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DRY_RUN=false
TARGET_DIR="${ROOT_DIR}"

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=true
      ;;
    *)
      TARGET_DIR="$arg"
      ;;
  esac
done

mkdir -p "${TARGET_DIR}"
ENV_FILE="${TARGET_DIR}/.env.pilot"
PORT="${PORT:-3001}"

echo "==> [1/4] Generating cryptographic ADMIN_KEY, SEARCH_KEY, DEMO_KEY & JWT_SECRET..."
if [ ! -f "${ENV_FILE}" ]; then
  ADMIN_HEX="eidos_ak_$(openssl rand -hex 24)"
  SEARCH_HEX="eidos_pk_$(openssl rand -hex 24)"
  DEMO_HEX="eidos_demo_$(openssl rand -hex 24)"
  JWT_HEX="eidos_jwt_$(openssl rand -hex 24)"
  (
    umask 077
    cat > "${ENV_FILE}" <<EOF
PORT=${PORT}
NODE_ENV=production
DATA_DIR=/var/lib/eidos
ADMIN_KEY=${ADMIN_HEX}
SEARCH_KEY=${SEARCH_HEX}
EIDOS_MASTER_KEY=${ADMIN_HEX}
EIDOS_ADMIN_KEY=${ADMIN_HEX}
EIDOS_SEARCH_KEY=${SEARCH_HEX}
EIDOS_PUBLIC_DEMO_KEY=${DEMO_HEX}
JWT_SECRET=${JWT_HEX}
EIDOS_ENABLE_DEMO_MUTATIONS=true
EIDOS_FAIL_CLOSED_EMPTY_INDEX=true
LOG_SUGGEST_RATE=0.2
CORS_ORIGIN=http://localhost:${PORT},http://127.0.0.1:${PORT}
REDIS_URL=redis://redis:6379
EOF
  )
  chmod 600 "${ENV_FILE}"
  echo "    Created ${ENV_FILE} (mode 0600)"
else
  echo "    Using existing ${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  ADMIN_HEX="${ADMIN_KEY:-${EIDOS_ADMIN_KEY}}"
  SEARCH_HEX="${SEARCH_KEY:-${EIDOS_SEARCH_KEY}}"
fi

if [ "${DRY_RUN}" = "true" ]; then
  echo "==> [DRY-RUN] Skipping docker compose up. Secrets written securely to ${ENV_FILE} (0600)."
  exit 0
fi

echo "==> [2/4] Starting EIDOS Pilot Docker stack..."
docker compose --env-file "${ENV_FILE}" -f "${ROOT_DIR}/docker-compose.pilot.yml" up -d

echo "==> [3/4] Waiting for GET /v1/ready..."
MAX_WAIT=30
ELAPSED=0
until curl -fsS "http://localhost:${PORT}/v1/ready" >/dev/null 2>&1; do
  sleep 1
  ELAPSED=$((ELAPSED + 1))
  if [ "${ELAPSED}" -ge "${MAX_WAIT}" ]; then
    echo "ERROR: EIDOS API did not become ready within ${MAX_WAIT}s" >&2
    exit 1
  fi
done

READY_JSON="$(curl -fsS "http://localhost:${PORT}/v1/ready")"
echo "    /v1/ready -> ${READY_JSON}"

echo ""
echo "=============================================================================="
echo "  EIDOS PILOT READY (15-Minute Onboarding)"
echo "=============================================================================="
echo "  API URL          : http://localhost:${PORT}"
echo "  Admin Console    : http://localhost:${PORT}/admin"
echo "  Public Demo      : http://localhost:${PORT}/public-demo"
echo "  Credentials File : ${ENV_FILE} (0600)"
echo "------------------------------------------------------------------------------"
echo "  Next step: Open WooCommerce or 1C-Bitrix EIDOS Setup Wizard, paste:"
echo "    1. API URL, SEARCH_KEY, ADMIN_KEY from ${ENV_FILE} -> 'Проверить соединение'"
echo "    2. Click 'Синхронизировать сейчас' (batches of 200 SKU)"
echo "    3. Enable Live Suggest + Full Search replacement"
echo "    4. Run 'Контрольная проверка (5 запросов)'"
echo "=============================================================================="
