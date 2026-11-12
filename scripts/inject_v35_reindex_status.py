#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "apps/api/tests/v35-production-gate.test.ts"
if not p.exists():
    raise SystemExit(0)
s = p.read_text(encoding="utf-8")
old = "expect(reindexRes.json().status).toBe('optimized');"
new = "expect(reindexRes.json().status).toBe('reindexed');"
if new in s:
    print("already")
elif old in s:
    p.write_text(s.replace(old, new), encoding="utf-8")
    print("written")
else:
    print("pattern missing")
