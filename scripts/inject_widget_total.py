#!/usr/bin/env python3
"""Ensure both widget copies show data.total and stay in sync."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
old = "leftSpan.textContent = results.length > 0 ? ('Найдено: ' + results.length) : 'Нет совпадений';"
new = """var totalCount = (data && typeof data.total === 'number') ? data.total : results.length;
      leftSpan.textContent = results.length > 0 ? ('Найдено: ' + totalCount) : 'Нет совпадений';"""
changed = False
for rel in ["public/widget.js", "apps/workspace/public/widget.js"]:
    p = ROOT / rel
    if not p.exists():
        continue
    s = p.read_text(encoding="utf-8")
    if "totalCount" in s and "data.total" in s:
        print(rel, "already")
        continue
    if old not in s:
        print(rel, "pattern missing")
        continue
    p.write_text(s.replace(old, new), encoding="utf-8")
    changed = True
    print(rel, "written")
pub = ROOT / "public/widget.js"
ws = ROOT / "apps/workspace/public/widget.js"
if pub.exists() and ws.exists():
    pub_s = pub.read_text(encoding="utf-8")
    ws_s = ws.read_text(encoding="utf-8")
    if pub_s != ws_s:
        src_s = pub_s if "totalCount" in pub_s else ws_s
        if "totalCount" in pub_s:
            ws.write_text(pub_s, encoding="utf-8")
        else:
            pub.write_text(ws_s, encoding="utf-8")
        print("synced copies")
if not changed:
    print("noop")
