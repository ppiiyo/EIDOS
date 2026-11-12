#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "tests/integration/prometheus-metrics.test.ts"
if not p.exists():
    raise SystemExit(0)
s = p.read_text(encoding="utf-8")
if "loadDemoCatalog(DEMO_CATALOG)" in s and "item_id: '1'" in s:
    print("already")
    raise SystemExit(0)
if "DEMO_CATALOG" not in s:
    s = s.replace(
        "import { StoreRegistry } from '../../apps/api/src/services/store-registry';",
        "import { StoreRegistry } from '../../apps/api/src/services/store-registry';\nimport { DEMO_CATALOG } from '../../apps/api/src/demo/demo-catalog';",
    )
old = """    // Load demo catalog for recommend test
    await app.inject({
      method: 'POST',
      url: '/v1/demo/load',
    });
"""
new = """    // Load demo catalog into demo + default stores (recommend hits default:default)
    await app.inject({
      method: 'POST',
      url: '/v1/demo/load',
    });
    await app.storeRegistry.getOrCreateStore('default', 'default').loadDemoCatalog(DEMO_CATALOG);
"""
if old in s:
    s = s.replace(old, new)
s = s.replace("item_id: 'item_1'", "item_id: '1'")
p.write_text(s, encoding="utf-8")
print("written")
