#!/usr/bin/env python3
"""Replace fixed eidos_jwt_secret dev fallback with ephemeral random secret."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "apps/api/src/middleware/auth.ts"
s = p.read_text(encoding="utf-8")
if "getDevJwtSecret" in s:
    print("already applied")
    raise SystemExit(0)

old = """  const jwtSecret = isProduction
    ? (process.env.JWT_SECRET || '').trim()
    : (process.env.JWT_SECRET || 'eidos_jwt_secret').trim();"""
new = """  const jwtSecret = isProduction
    ? (process.env.JWT_SECRET || '').trim()
    : (process.env.JWT_SECRET || getDevJwtSecret()).trim();"""
if old not in s:
    raise SystemExit("JWT pattern not found")

helper = """
let _devJwtSecret: string | null = null;
function getDevJwtSecret(): string {
  if (_devJwtSecret) return _devJwtSecret;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { randomBytes } = require('crypto') as typeof import('crypto');
  _devJwtSecret = randomBytes(32).toString('hex');
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[EIDOS] JWT_SECRET not set; using ephemeral random secret for this process (dev only).');
  }
  return _devJwtSecret;
}

"""
s = s.replace(old, new)
idx = s.find("\nexport ")
if idx < 0:
    raise SystemExit("export anchor missing")
s = s[:idx] + "\n" + helper + s[idx:]
p.write_text(s, encoding="utf-8")
print("written", p)
