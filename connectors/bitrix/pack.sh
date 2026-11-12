#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# EIDOS 1C-Bitrix Module Packager (eidos.connector)
# Builds eidos.connector.tar.gz ready for extraction into /bitrix/modules/
# from the canonical packages/connectors/bitrix module.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
MODULE_SRC="${REPO_ROOT}/packages/connectors/bitrix"
DIST_DIR="${SCRIPT_DIR}/dist"
STAGE_DIR="${DIST_DIR}/eidos.connector"
ARCHIVE="${DIST_DIR}/eidos.connector.tar.gz"

rm -rf "${DIST_DIR}"
mkdir -p "${STAGE_DIR}"

cp -R "${MODULE_SRC}/." "${STAGE_DIR}/"
rm -rf "${STAGE_DIR}/vendor" "${STAGE_DIR}/tests"

tar -czf "${ARCHIVE}" -C "${DIST_DIR}" eidos.connector
rm -rf "${STAGE_DIR}"

echo "✅ Packaged 1C-Bitrix module: ${ARCHIVE}"
echo "   Extract on Bitrix server: tar -xzf eidos.connector.tar.gz -C /var/www/html/bitrix/modules/"
