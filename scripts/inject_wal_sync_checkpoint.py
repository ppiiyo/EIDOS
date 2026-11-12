#!/usr/bin/env python3
"""Checkpoint must fully write snapshot before WAL truncate — use saveSnapshotSync in WAL callback."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "apps/api/src/services/vector-store.ts"
s = p.read_text(encoding="utf-8")
old = "new WriteAheadLog(10000, () => this.saveSnapshotAsync(), this.walPath)"
new = "new WriteAheadLog(10000, () => this.saveSnapshotSync(), this.walPath)"
if old not in s:
    if s.count(new) >= 1:
        print("already applied")
        raise SystemExit(0)
    raise SystemExit("pattern not found")
s = s.replace(old, new)
p.write_text(s, encoding="utf-8")
print("replaced", s.count(new), "WAL callbacks")
