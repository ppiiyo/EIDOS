#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "apps/api/src/server.ts"
s = p.read_text(encoding="utf-8")
old = "  fastify.get('/metrics', { preHandler: authenticate }, handlePrometheusMetrics);"
new = "  fastify.get('/metrics', handlePrometheusMetrics);"
if new in s:
    print("already")
elif old in s:
    p.write_text(s.replace(old, new), encoding="utf-8")
    print("written")
else:
    print("pattern missing")
