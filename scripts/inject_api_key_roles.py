#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "apps/api/src/services/api-key-manager.ts"
s = p.read_text(encoding="utf-8")
changed = False
old = "export type ApiKeyScopeRole = 'master' | 'admin' | 'search' | 'merchandiser';"
new = "export type ApiKeyScopeRole = 'master' | 'admin' | 'search' | 'merchandiser' | 'viewer' | 'editor';"
if new not in s and old in s:
    s = s.replace(old, new)
    changed = True
    print("roles")
old_pm = """    const prefixMap: Record<ApiKeyScopeRole, string> = {
      master: 'eidos_mk_',
      admin: 'eidos_ak_',
      search: 'eidos_pk_',
      merchandiser: 'eidos_merch_',
    };
"""
new_pm = """    const prefixMap: Record<ApiKeyScopeRole, string> = {
      master: 'eidos_mk_',
      admin: 'eidos_ak_',
      search: 'eidos_pk_',
      merchandiser: 'eidos_merch_',
      viewer: 'eidos_vw_',
      editor: 'eidos_ed_',
    };
"""
if "viewer: 'eidos_vw_'" not in s and old_pm in s:
    s = s.replace(old_pm, new_pm)
    changed = True
    print("prefix")
if changed:
    p.write_text(s, encoding="utf-8")
else:
    print("already")
