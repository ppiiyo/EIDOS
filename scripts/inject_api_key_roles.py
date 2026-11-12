#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "apps/api/src/services/api-key-manager.ts"
s = p.read_text(encoding="utf-8")
old = "export type ApiKeyScopeRole = 'master' | 'admin' | 'search' | 'merchandiser';"
new = "export type ApiKeyScopeRole = 'master' | 'admin' | 'search' | 'merchandiser' | 'viewer' | 'editor';"
if new in s:
    print("already")
elif old in s:
    p.write_text(s.replace(old, new), encoding="utf-8")
    print("written")
else:
    print("missing")
