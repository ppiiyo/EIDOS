#!/usr/bin/env python3
"""Demo sandbox must not persist to disk — avoids cross-run DEMO_DISABLED_FOR_PRODUCTION_CATALOG."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "apps/api/src/services/store-registry.ts"
s = p.read_text(encoding="utf-8")
if "Demo sandbox is ephemeral" in s:
    print("already")
    raise SystemExit(0)
old = """    if (tenantId === 'demo') {
      const dir = path.join(os.tmpdir(), 'eidos-demo', indexName);
      return { walPath: path.join(dir, 'catalog.wal.jsonl'), snapshotPath: path.join(dir, 'catalog.snapshot.json') };
    }
"""
new = """    if (tenantId === 'demo') {
      // Demo sandbox is ephemeral: no disk persistence (avoids cross-run 409 DEMO_DISABLED).
      return {};
    }
"""
if old not in s:
    raise SystemExit("pattern missing")
p.write_text(s.replace(old, new), encoding="utf-8")
print("written")
