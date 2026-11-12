#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "apps/api/src/routes/search.ts"
s = p.read_text(encoding="utf-8")
old = """      const minScore =
        rawMinScore ?? (rankingDefaults.minScore !== 0.09 ? rankingDefaults.minScore : undefined);
"""
new = "      const minScore = rawMinScore ?? rankingDefaults.minScore ?? 0.09;\n"
if old in s:
    p.write_text(s.replace(old, new), encoding="utf-8")
    print("written")
elif "rankingDefaults.minScore ?? 0.09" in s:
    print("already")
else:
    print("missing")
