#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# EIDOS v3.4.0 — One-Command Self-Hosted Pilot Installer
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/ppiiyo/EIDOS/main/scripts/install-pilot.sh | bash
#   or locally:
#   ./scripts/install-pilot.sh [--dry-run]
# ==============================================================================

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

echo "================================================================"
echo " ⚡ EIDOS v3.4.0 — Установка Self-Hosted Пилота (One-Command)"
echo "================================================================"

# 1. Verify Docker & docker compose plugin (skipped in --dry-run CI mode)
if [[ "${DRY_RUN}" != "true" ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "❌ Ошибка: Docker не установлен. Установите Docker: https://docs.docker.com/engine/install/"
    exit 1
  fi

  if ! docker compose version >/dev/null 2>&1; then
    echo "❌ Ошибка: Плагин 'docker compose' не найден. Установите docker-compose-plugin."
    exit 1
  fi
fi

# 2. Prepare pilot directory & compose configuration
PILOT_DIR="${2:-${EIDOS_PILOT_DIR:-$(pwd)}}"
mkdir -p "${PILOT_DIR}"
if [[ ! -f "${PILOT_DIR}/docker-compose.pilot.yml" && -z "${2:-}" ]]; then
  PILOT_DIR="$(pwd)/eidos-pilot"
  mkdir -p "${PILOT_DIR}"
fi

generate_secret_key() {
  local prefix="$1"
  if command -v openssl >/dev/null 2>&1; then
    echo "${prefix}_$(openssl rand -hex 20)"
  else
    echo "${prefix}_$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' | cut -c1-40)"
  fi
}

ENV_FILE="${PILOT_DIR}/.env"
if [[ -f "${ENV_FILE}" ]]; then
  echo "ℹ️  Найден существующий файл ${ENV_FILE} — используем сохранённые ключи."
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
else
  EIDOS_MASTER_KEY="$(generate_secret_key "eidos_mk")"
  EIDOS_ADMIN_KEY="$(generate_secret_key "eidos_ak")"
  EIDOS_SEARCH_KEY="$(generate_secret_key "eidos_sk")"
  PORT="${PORT:-3001}"

  cat > "${ENV_FILE}" <<EOF
# EIDOS v3.4.0 Pilot Environment (Auto-generated — DO NOT COMMIT)
NODE_ENV=production
PORT=${PORT}
EIDOS_STRICT_PROD_BOOT=true
EIDOS_MASTER_KEY=${EIDOS_MASTER_KEY}
EIDOS_ADMIN_KEY=${EIDOS_ADMIN_KEY}
EIDOS_SEARCH_KEY=${EIDOS_SEARCH_KEY}
CORS_ORIGIN=*
REDIS_URL=redis://redis:6379
EIDOS_SNAPSHOT_PATH=/app/data/snapshots/catalog.snapshot.json
EIDOS_SNAPSHOT_INTERVAL_MS=300000
EIDOS_AUTO_RESTORE_SNAPSHOT=true
EIDOS_RATE_LIMIT_MAX=600
EOF
  chmod 600 "${ENV_FILE}" || true
  echo "✅ Сгенерированы криптостойкие ключи (>= 32 символов) в ${ENV_FILE}"
fi

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "✅ [DRY-RUN] Проверка конфигурации завершена успешно."
  echo "   EIDOS_SEARCH_KEY=${EIDOS_SEARCH_KEY}"
  echo "   EIDOS_ADMIN_KEY=${EIDOS_ADMIN_KEY}"
  exit 0
fi

# 3. Start Docker Compose stack
COMPOSE_FILE="docker-compose.pilot.yml"
if [[ ! -f "${PILOT_DIR}/${COMPOSE_FILE}" && -f "$(pwd)/docker-compose.pilot.yml" ]]; then
  cp "$(pwd)/docker-compose.pilot.yml" "${PILOT_DIR}/${COMPOSE_FILE}"
fi

echo "🚀 Запуск контейнеров EIDOS (API + Redis)..."
(cd "${PILOT_DIR}" && docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --build)

# 4. Wait for GET /v1/ready == 200 (timeout 120s)
API_URL="http://localhost:${PORT:-3001}"
TIMEOUT_SEC=120
ELAPSED=0

echo "⏳ Ожидание готовности индекса (${API_URL}/v1/ready, таймаут ${TIMEOUT_SEC} сек)..."
while [[ ${ELAPSED} -lt ${TIMEOUT_SEC} ]]; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/v1/ready" || echo "000")
  if [[ "${HTTP_CODE}" == "200" ]]; then
    echo "✅ Сервис EIDOS готов к работе (GET /v1/ready -> 200 OK)!"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done

if [[ ${ELAPSED} -ge ${TIMEOUT_SEC} ]]; then
  echo "❌ Ошибка: Сервис не перешёл в состояние ready за ${TIMEOUT_SEC} секунд."
  echo "   Проверьте логи: docker compose -f ${PILOT_DIR}/${COMPOSE_FILE} logs --tail=50 api"
  exit 1
fi

echo ""
echo "================================================================"
echo " 🎉 EIDOS v3.4.0 УСПЕШНО ЗАПУЩЕН!"
echo "================================================================"
echo " 🌐 URL Студии и API:        ${API_URL}"
echo " 🧭 Мастер онбординга:       ${API_URL}/onboarding"
echo "----------------------------------------------------------------"
echo " 🔑 SEARCH_KEY (для виджета на сайте — только чтение):"
echo "    ${EIDOS_SEARCH_KEY}"
echo ""
echo " 🔐 ADMIN_KEY (только для загрузки каталога — НЕ вставлять на сайт):"
echo "    ${EIDOS_ADMIN_KEY}"
echo "----------------------------------------------------------------"
echo " 👉 Следующий шаг: откройте в браузере ${API_URL}/onboarding"
echo "    загрузите ваш CSV-каталог и скопируйте готовый HTML-код виджета."
echo "================================================================"
