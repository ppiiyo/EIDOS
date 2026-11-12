#!/usr/bin/env python3
"""Surgical inject whenReady + wasEmptyBeforeRestore into vector-store.ts. Idempotent."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "apps/api/src/services/vector-store.ts"
s = p.read_text(encoding="utf-8")
changed = False

if "public whenReady()" not in s:
    gate = (
        "  private readyPromise: Promise<void> = Promise.resolve();\n"
        "  public setReadyPromise(p: Promise<void>): void { this.readyPromise = p; }\n"
        "  public whenReady(): Promise<void> { return this.readyPromise; }\n\n"
    )
    m = re.search(r"(\n[ \t]*)(public[ \t]+async[ \t]+loadSnapshotFromDisk[ \t]*\()", s)
    if not m:
        raise SystemExit("loadSnapshotFromDisk not found")
    s = s[: m.start()] + "\n" + gate + m.group(1) + m.group(2) + s[m.end() :]
    changed = True
    print("+ whenReady")

if "wasEmptyBeforeRestore" not in s:
    anchor = "  ): Promise<number> {\n    const hasExplicitEmbedder ="
    inject = "  ): Promise<number> {\n    const wasEmptyBeforeRestore = this.items.size === 0;\n    const hasExplicitEmbedder ="
    if anchor not in s:
        raise SystemExit("loadSnapshot body anchor missing")
    s = s.replace(anchor, inject, 1)
    changed = True
    print("+ wasEmptyBeforeRestore")

if "snapshotIds.size >= 100 && wasEmptyBeforeRestore" not in s:
    s2, n = re.subn(
        r"if\s*\(\s*snapshotIds\.size\s*>=\s*100\s*\)\s*\{",
        "if (snapshotIds.size >= 100 && wasEmptyBeforeRestore) {",
        s,
        count=1,
    )
    if n != 1:
        raise SystemExit("purge pattern not found")
    s = s2
    changed = True
    print("+ purge guard")

if "offset + limit + 25" in s:
    s = s.replace("offset + limit + 25", "offset + limit + 50")
    changed = True
    print("+ deep page")

if changed:
    p.write_text(s, encoding="utf-8")
    print("written", p)
else:
    print("already applied")
