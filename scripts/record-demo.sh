#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo " EIDOS Demo Recording Pipeline"
echo "=========================================="

OUTPUT_DIR="./docs"
VIDEO_DIR="./tests/recordings"
mkdir -p "${OUTPUT_DIR}" "${VIDEO_DIR}"

echo "[1/4] Checking prerequisites..."
command -v npx >/dev/null 2>&1 || { echo "npx is required but not installed. Aborting."; exit 1; }
command -v ffmpeg >/dev/null 2>&1 || { echo "ffmpeg is required for GIF generation. Aborting."; exit 1; }

echo "[2/4] Launching Playwright recording scenario..."
# Playwright script executing: Catalog load -> Graph view toggle -> Click item -> Recommendations inspect -> Semantic query search
npx playwright test tests/e2e/demo.spec.ts --project=chromium --reporter=line

RECORDED_WEBM=$(find "${VIDEO_DIR}" -name "*.webm" | head -n 1)

if [[ -z "${RECORDED_WEBM}" || ! -f "${RECORDED_WEBM}" ]]; then
  echo "Error: Recorded video file was not generated."
  exit 1
fi

echo "[3/4] Converting WebM to high-clarity 30fps optimized GIF via ffmpeg..."
PALETTE="/tmp/eidos_palette.png"

ffmpeg -y -i "${RECORDED_WEBM}" \
  -vf "fps=20,scale=960:-1:flags=lanczos,palettegen=stats_mode=diff" \
  "${PALETTE}"

ffmpeg -y -i "${RECORDED_WEBM}" -i "${PALETTE}" \
  -lavfi "fps=20,scale=960:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
  "${OUTPUT_DIR}/demo.gif"

rm -f "${PALETTE}"

echo "[4/4] Demo recording successfully generated: ${OUTPUT_DIR}/demo.gif"
ls -lh "${OUTPUT_DIR}/demo.gif"
