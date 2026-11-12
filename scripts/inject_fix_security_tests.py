#!/usr/bin/env python3
"""Align security tests with production-safe CORS/JWT and optional Redis."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEST_JWT = "test-jwt-secret-at-least-24chars!!"

p = ROOT / "apps/api/tests/phase1-api-hardening.test.ts"
if p.exists():
    s = p.read_text(encoding="utf-8")
    changed = False
    if "http://localhost:3000" not in s or "ai.studio" in s:
        s = s.replace(
            """  beforeAll(async () => {
    process.env.AIL_ENABLED = 'true';
    app = await buildServer();
""",
            f"""  beforeAll(async () => {{
    process.env.AIL_ENABLED = 'true';
    process.env.JWT_SECRET = process.env.JWT_SECRET || '{TEST_JWT}';
    process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000';
    app = await buildServer();
""",
        )
        s = s.replace(
            "https://eidos-semantic-ideation-platform.ai.studio",
            "http://localhost:3000",
        )
        s = s.replace(
            "const secret = 'eidos_jwt_secret';",
            f"const secret = process.env.JWT_SECRET || '{TEST_JWT}';",
        )
        s = s.replace("'eidos_jwt_secret'", f"process.env.JWT_SECRET || '{TEST_JWT}'")
        changed = True
    old_redis = "expect(healthNoKeyRes.json().checks.redis.stats.type).toBe('redis');"
    new_redis = "expect(['redis', 'in-memory']).toContain(healthNoKeyRes.json().checks.redis.stats?.type);"
    if old_redis in s:
        s = s.replace(old_redis, new_redis)
        changed = True
    if changed:
        p.write_text(s, encoding="utf-8")
        print("phase1 fixed")
    else:
        print("phase1 ok")

p2 = ROOT / "apps/api/tests/p0-p1-final-audit.test.ts"
if p2.exists():
    s2 = p2.read_text(encoding="utf-8")
    changed2 = False
    if "eidos_jwt_secret" in s2:
        s2 = s2.replace("'eidos_jwt_secret'", f"process.env.JWT_SECRET || '{TEST_JWT}'")
        changed2 = True
    target_call = "    const app = await buildServer();\n    try {\n      // > 500 items rejected with 400"
    injected_call = f"    process.env.JWT_SECRET = process.env.JWT_SECRET || '{TEST_JWT}';\n    const app = await buildServer();\n    try {{\n      // > 500 items rejected with 400"
    if target_call in s2 and f"process.env.JWT_SECRET = process.env.JWT_SECRET || '{TEST_JWT}';" not in s2:
        s2 = s2.replace(target_call, injected_call, 1)
        changed2 = True
    if changed2:
        p2.write_text(s2, encoding="utf-8")
        print("p0-p1 fixed")
    else:
        print("p0-p1 ok")

