#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT_DIR="$ROOT_DIR/dist"
mkdir -p "$OUT_DIR"
OUT_ZIP="$OUT_DIR/eidos-bitrix-module.zip"

rm -f "$OUT_ZIP"

if command -v zip >/dev/null 2>&1; then
  (cd "$SCRIPT_DIR" && zip -rq "$OUT_ZIP" eidos.search)
elif command -v python3 >/dev/null 2>&1; then
  python3 - "$SCRIPT_DIR" "$OUT_ZIP" << 'PYEOF'
import os, sys, zipfile
base_dir = sys.argv[1]
out_zip = sys.argv[2]
target_dir = os.path.join(base_dir, "eidos.search")
with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, _, files in os.walk(target_dir):
        for f in files:
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, base_dir)
            zf.write(full_path, rel_path)
PYEOF
else
  tar -czf "$OUT_ZIP" -C "$SCRIPT_DIR" eidos.search
fi

echo "1C-Bitrix module archive created: $OUT_ZIP"
