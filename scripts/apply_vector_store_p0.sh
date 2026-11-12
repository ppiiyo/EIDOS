#!/usr/bin/env bash
# Apply P0 VectorStore readiness + correct purge. Run from repo root.
set -euo pipefail
cd "$(dirname "$0")/.."
if grep -q 'public whenReady()' apps/api/src/services/vector-store.ts 2>/dev/null; then
  echo "= whenReady already present"
  exit 0
fi
if command -v patch >/dev/null 2>&1; then
  patch -p1 < patches/vector-store.p0.diff
else
  python3 scripts/apply_master_p0.py
fi
echo "OK: vector-store P0 applied. Run: pnpm -r exec tsc --noEmit && pnpm test"
