#!/usr/bin/env python3
"""Seed default store in critical-routes tests so /v1/search and /v1/recommend see catalog."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "tests/integration/critical-routes.test.ts"
if not p.exists():
    raise SystemExit(0)
s = p.read_text(encoding="utf-8")
if "loadDemoCatalog(DEMO_CATALOG)" in s:
    print("already")
    raise SystemExit(0)
if "DEMO_CATALOG" not in s:
    s = s.replace(
        "import { buildServer } from '../../apps/api/src/server';",
        "import { buildServer } from '../../apps/api/src/server';\nimport { DEMO_CATALOG } from '../../apps/api/src/demo/demo-catalog';",
    )
old = """  describe('Demo Endpoints (no auth required)', () => {
    beforeAll(async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/demo/load',
      });
    });
"""
new = """  describe('Demo Endpoints (no auth required)', () => {
    beforeAll(async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/demo/load',
      });
      // Protected /v1/search and /v1/recommend use default:default — seed it too.
      await app.storeRegistry.getOrCreateStore('default', 'default').loadDemoCatalog(DEMO_CATALOG);
    });
"""
if old not in s:
    raise SystemExit("pattern missing")
p.write_text(s.replace(old, new), encoding="utf-8")
print("written")
