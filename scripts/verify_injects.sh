#!/usr/bin/env bash
# Fail if critical P0/production inject markers are missing from the tree.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0
check() {
  local file="$1" pattern="$2" label="$3"
  if [ ! -f "$file" ]; then
    echo "FAIL missing file: $file ($label)"
    fail=1
    return
  fi
  if ! grep -qE "$pattern" "$file"; then
    echo "FAIL marker not found in $file: $pattern ($label)"
    fail=1
  else
    echo "OK  $label"
  fi
}

check apps/api/src/services/store-registry.ts "Demo sandbox is ephemeral" "demo ephemeral"
check apps/api/src/services/store-registry.ts "httpError" "StoreError HTTP names"
check apps/api/src/plugins/security.ts "skip-override" "security skip-override"
check apps/api/src/server.ts "fastify.get\('/metrics', handlePrometheusMetrics\)" "public /metrics"
check apps/api/src/middleware/auth.ts "never escalate" "RBAC role demotion"
check apps/api/src/services/api-key-manager.ts "viewer.*editor|editor.*viewer" "viewer/editor roles"
check apps/api/src/services/vector-store.ts "whenReady|setReadyPromise" "VectorStore whenReady"

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "Inject verification FAILED. Run: for s in scripts/inject_*.py; do python3 \"\$s\"; done"
  exit 1
fi
echo "All inject markers present."
