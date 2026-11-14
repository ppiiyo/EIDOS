#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# EIDOS WooCommerce Plugin Packager (eidos-woocommerce)
# Builds dist/eidos-woocommerce-plugin.zip from canonical packages/connectors/woocommerce
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MODULE_SRC="$ROOT_DIR/packages/connectors/woocommerce"
OUT_DIR="$ROOT_DIR/dist"
STAGE_PARENT="$SCRIPT_DIR/dist"
STAGE_DIR="$STAGE_PARENT/eidos-woocommerce"
OUT_ZIP="$OUT_DIR/eidos-woocommerce-plugin.zip"

mkdir -p "$OUT_DIR"
rm -rf "$STAGE_PARENT" "$OUT_ZIP"
mkdir -p "$STAGE_DIR"

cp -R "$MODULE_SRC/." "$STAGE_DIR/"
rm -rf "$STAGE_DIR/vendor" "$STAGE_DIR/tests"

if command -v zip >/dev/null 2>&1; then
  (cd "$STAGE_PARENT" && zip -rq "$OUT_ZIP" eidos-woocommerce)
elif command -v python3 >/dev/null 2>&1; then
  python3 - "$STAGE_PARENT" "$OUT_ZIP" << 'PYEOF'
import os, sys, zipfile
base_dir = sys.argv[1]
out_zip = sys.argv[2]
target_dir = os.path.join(base_dir, "eidos-woocommerce")
with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, _, files in os.walk(target_dir):
        for f in files:
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, base_dir)
            zf.write(full_path, rel_path)
PYEOF
else
  tar -czf "$OUT_ZIP" -C "$STAGE_PARENT" eidos-woocommerce
fi

rm -rf "$STAGE_PARENT"

echo "WooCommerce plugin archive created: $OUT_ZIP"
