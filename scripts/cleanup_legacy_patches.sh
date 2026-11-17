#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
rm -f "$ROOT/apply_eidos_hotfix.py" "$ROOT/apply_eidos_p0_round2.py" "$ROOT/patches/vector-store.p0.diff"
rmdir "$ROOT/patches" 2>/dev/null || true
echo "legacy patch artifacts removed"
