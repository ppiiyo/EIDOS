#!/usr/bin/env python3
"""Assemble pnpm-lock.yaml from scripts/lockfile.part*.b64 (gzip+base64)."""
import base64, gzip
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
parts = sorted((ROOT / "scripts").glob("lockfile.part*.b64"))
if not parts:
    raise SystemExit("no lockfile.part*.b64 found")
b64 = "".join(p.read_text().strip() for p in parts)
data = gzip.decompress(base64.b64decode(b64))
out = ROOT / "pnpm-lock.yaml"
out.write_bytes(data)
print(f"wrote {out} ({len(data)} bytes) from {len(parts)} parts")
