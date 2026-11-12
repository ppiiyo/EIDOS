#!/usr/bin/env python3
"""Replace non-existent HNSWIndex.fastInsertLeaf with public insert()."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "tests/benchmarks/search-sla.test.ts"
if not p.exists():
    print("missing")
    raise SystemExit(0)
s = p.read_text(encoding="utf-8")
if "fastInsertLeaf(" not in s:
    print("already")
    raise SystemExit(0)

old1 = """      if (i < 128) {
        hnswIndex.insert(id, vector);
        anchorIds.push(id);
      } else {
        hnswIndex.fastInsertLeaf(id, vector, anchorIds[i % anchorIds.length]);
      }
"""
new1 = """      hnswIndex.insert(id, vector);
      if (i < 128) {
        anchorIds.push(id);
      }
"""
if old1 in s:
    s = s.replace(old1, new1)
    print("corpus")

old2 = """      if (i < 64) {
        batchHnsw.insert(item.id, item.vector);
        anchors.push(item.id);
      } else {
        batchHnsw.fastInsertLeaf(item.id, item.vector, anchors[i % anchors.length]);
      }
"""
new2 = """      batchHnsw.insert(item.id, item.vector);
      if (i < 64) {
        anchors.push(item.id);
      }
"""
if old2 in s:
    s = s.replace(old2, new2)
    print("batch")

# Fallback: any remaining calls
s2 = s.replace(
    "hnswIndex.fastInsertLeaf(id, vector, anchorIds[i % anchorIds.length]);",
    "hnswIndex.insert(id, vector);",
)
s2 = s2.replace(
    "batchHnsw.fastInsertLeaf(item.id, item.vector, anchors[i % anchors.length]);",
    "batchHnsw.insert(item.id, item.vector);",
)
p.write_text(s2, encoding="utf-8")
print("done", "fastInsertLeaf(" in s2)
