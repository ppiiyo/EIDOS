#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "apps/api/src/services/embedder.ts"
s = p.read_text(encoding="utf-8")
if "function isOnnxEmbedderEnabled" in s:
    print("already")
    raise SystemExit(0)
helper = '''
/** Single source of truth for ONNX embedder flag (accepts legacy EIDOS_USE_ONNX alias). */
function isOnnxEmbedderEnabled(): boolean {
  return process.env.EIDOS_USE_ONNX_EMBEDDER === 'true' || process.env.EIDOS_USE_ONNX === 'true';
}

'''
m = re.search(r'\nexport class ServerEmbedder', s)
if not m:
    raise SystemExit("class missing")
s = s[: m.start()] + "\n" + helper + s[m.start() :]
s = s.replace("process.env.EIDOS_USE_ONNX_EMBEDDER !== 'true'", "!isOnnxEmbedderEnabled()")
s = s.replace(
    "process.env.EIDOS_USE_ONNX_EMBEDDER === 'true' || process.env.EIDOS_USE_ONNX === 'true'",
    "isOnnxEmbedderEnabled()",
)
p.write_text(s)
print("written")
