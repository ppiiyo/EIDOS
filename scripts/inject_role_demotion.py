#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "apps/api/src/middleware/auth.ts"
s = p.read_text(encoding="utf-8")
if "never escalate" in s:
    print("already")
    raise SystemExit(0)
anchor = """  if (!resolvedRole) {
    request.log.warn({
      event: 'auth_failed',
      reason: 'invalid_key',
"""
demote = """  // Optional role demotion for admin/master (x-eidos-role header) — never escalate.
  if (resolvedRole === 'master' || resolvedRole === 'admin') {
    const raw = String(request.headers['x-eidos-role'] || '').trim().toLowerCase();
    const allowed = new Set(['viewer', 'search', 'editor', 'admin', 'master']);
    if (raw && allowed.has(raw) && raw !== 'master') {
      const rank: Record<string, number> = { viewer: 1, search: 2, editor: 3, admin: 4, master: 5 };
      if ((rank[raw] || 0) <= (rank[resolvedRole] || 0)) {
        resolvedRole = raw as ApiKeyScopeRole;
      }
    }
  }

  if (!resolvedRole) {
    request.log.warn({
      event: 'auth_failed',
      reason: 'invalid_key',
"""
if anchor not in s:
    raise SystemExit("anchor missing")
p.write_text(s.replace(anchor, demote, 1), encoding="utf-8")
print("written")
