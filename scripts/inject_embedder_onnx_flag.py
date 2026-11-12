#!/usr/bin/env python3
"""Unify EIDOS_USE_ONNX / EIDOS_USE_ONNX_EMBEDDER behind isOnnxEmbedderEnabled()."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "apps/api/src/services/embedder.ts"
s = p.read_text(encoding="utf-8")

CORRECT = (
    "function isOnnxEmbedderEnabled(): boolean {\n"
    "  return process.env.EIDOS_USE_ONNX_EMBEDDER === 'true' || process.env.EIDOS_USE_ONNX === 'true';\n"
    "}"
)

# Always repair recursive body if present
s = re.sub(
    r"function isOnnxEmbedderEnabled\(\): boolean \{\s*return isOnnxEmbedderEnabled\(\);\s*\}",
    CORRECT,
    s,
)

if "function isOnnxEmbedderEnabled" not in s:
    helper = (
        "\n/** Single source of truth for ONNX embedder flag (accepts legacy EIDOS_USE_ONNX alias). */\n"
        + CORRECT
        + "\n\n"
    )
    m = re.search(r"\nexport class ServerEmbedder", s)
    if not m:
        raise SystemExit("class missing")
    s = s[: m.start()] + helper + s[m.start() :]

# Replace env checks OUTSIDE the helper only: skip lines that are the helper return
lines = s.splitlines(keepends=True)
out = []
in_helper = False
for line in lines:
    if "function isOnnxEmbedderEnabled" in line:
        in_helper = True
    if in_helper and line.strip() == "}":
        in_helper = False
        out.append(line)
        continue
    if not in_helper:
        if "process.env.EIDOS_USE_ONNX_EMBEDDER !== 'true'" in line:
            line = line.replace(
                "process.env.EIDOS_USE_ONNX_EMBEDDER !== 'true'",
                "!isOnnxEmbedderEnabled()",
            )
        elif (
            "process.env.EIDOS_USE_ONNX_EMBEDDER === 'true'" in line
            and "process.env.EIDOS_USE_ONNX === 'true'" in line
        ):
            line = re.sub(
                r"process\.env\.EIDOS_USE_ONNX_EMBEDDER\s*===\s*'true'\s*\|\|\s*process\.env\.EIDOS_USE_ONNX\s*===\s*'true'",
                "isOnnxEmbedderEnabled()",
                line,
            )
    out.append(line)
s = "".join(out)

# Final guard
if re.search(
    r"function isOnnxEmbedderEnabled\(\): boolean \{\s*return isOnnxEmbedderEnabled\(\);",
    s,
):
    raise SystemExit("recursive body still present")

p.write_text(s, encoding="utf-8")
print("ok")
