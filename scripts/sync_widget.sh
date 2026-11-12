#!/usr/bin/env bash
# Keep storefront widget copies identical (API public/ and SPA public/).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/public/widget.js"
DST="$ROOT/apps/workspace/public/widget.js"
if [ ! -f "$SRC" ]; then
  echo "missing $SRC" >&2
  exit 1
fi
cp "$SRC" "$DST"
echo "Synced widget.js → apps/workspace/public/widget.js"
diff -q "$SRC" "$DST"
