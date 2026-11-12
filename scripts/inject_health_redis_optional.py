#!/usr/bin/env python3
"""Redis/cache is optional for /v1/health and /ready."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "apps/api/src/routes/health.ts"
if not p.exists():
    raise SystemExit(0)
s = p.read_text(encoding="utf-8")
changed = False

old_h = "    const isHealthy = Object.values(checks).every((c) => c.status === 'ok');\n"
new_h = (
    "    // Redis/cache is optional: degraded cache must not fail the readiness health probe.\n"
    "    const critical = [checks.vectorStore, checks.database, checks.embeddingModel, checks.memory, checks.uptime];\n"
    "    const isHealthy = critical.every((c) => c.status === 'ok');\n"
)
if "critical.every" not in s and old_h in s:
    s = s.replace(old_h, new_h)
    changed = True
    print("health critical fixed")

old_ready = (
    "    const isReady =\n"
    "      vectorStore.status === 'ok' &&\n"
    "      database.status === 'ok' &&\n"
    "      embeddingModel.status === 'ok' &&\n"
    "      redisHealthy;\n"
)
new_ready = (
    "    // Redis is optional cache layer \u2014 readiness does not require it.\n"
    "    const isReady =\n"
    "      vectorStore.status === 'ok' &&\n"
    "      database.status === 'ok' &&\n"
    "      embeddingModel.status === 'ok';\n"
)
if "optional cache layer" not in s and old_ready in s:
    s = s.replace(old_ready, new_ready)
    changed = True
    print("ready fixed")

if changed:
    p.write_text(s, encoding="utf-8")
else:
    print("already applied" if "critical.every" in s else "patterns missing")
