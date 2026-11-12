#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "apps/api/src/services/store-registry.ts"
s = p.read_text(encoding="utf-8")
if "httpError" in s:
    print("already")
    raise SystemExit(0)
old = """  public toJSON(): Record<string, unknown> {
    return { statusCode: this.statusCode, error: 'Store Error', code: this.code, message: this.message, ...(this.details ? { details: this.details } : {}) };
  }
"""
new = """  public toJSON(): Record<string, unknown> {
    const httpError =
      this.statusCode === 404 ? 'Not Found' :
      this.statusCode === 409 ? 'Conflict' :
      this.statusCode === 429 ? 'Too Many Requests' :
      this.statusCode === 504 ? 'Gateway Timeout' :
      this.statusCode >= 500 ? 'Internal Server Error' :
      'Bad Request';
    return { statusCode: this.statusCode, error: httpError, code: this.code, message: this.message, ...(this.details ? { details: this.details } : {}) };
  }
"""
if old not in s:
    raise SystemExit("pattern missing")
p.write_text(s.replace(old, new), encoding="utf-8")
print("written")
