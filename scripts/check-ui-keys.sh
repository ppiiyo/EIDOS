#!/usr/bin/env bash
set -euo pipefail

echo "[check-ui-keys] Scanning apps/workspace/src and public/widget.js for forbidden hardcoded keys..."

FORBIDDEN_PATTERN="eidos_dev_key|eidos_test_key_1|eidos_public_demo_key_2026|eidos_demo_key_2026_public"

if grep -rnE "$FORBIDDEN_PATTERN" apps/workspace/src; then
  echo "❌ ERROR: Forbidden hardcoded API key found in apps/workspace/src!"
  exit 1
fi

if grep -rnE "eidos_dev_key|eidos_public_demo_key_2026" public/widget.js; then
  echo "❌ ERROR: Forbidden fallback key found in public/widget.js!"
  exit 1
fi

echo "✅ [check-ui-keys] Clean: 0 hardcoded privileged/demo keys in frontend bundle."
