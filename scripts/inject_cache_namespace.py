#!/usr/bin/env python3
"""Always namespace search/recommend cache keys; fix default-tenant invalidation."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

p = ROOT / "apps/api/src/services/cache/cache-keys.ts"
s = p.read_text(encoding="utf-8")
old = """    const hash = this.hashObject(normalized);
    return namespace && namespace !== 'default:default'
      ? `search:${namespace}:${hash}`
      : `search:${hash}`;
"""
new = """    const hash = this.hashObject(normalized);
    const ns = namespace && namespace.trim() ? namespace : 'default:default';
    return `search:${ns}:${hash}`;
"""
if old in s:
    s = s.replace(old, new)
    print("search keys")
old_r = """    const prefix =
      namespace && namespace !== 'default:default'
        ? `recommend:${namespace}:${strategy}:${itemId}:${limit}`
        : `recommend:${strategy}:${itemId}:${limit}`;
"""
new_r = """    const ns = namespace && namespace.trim() ? namespace : 'default:default';
    const prefix = `recommend:${ns}:${strategy}:${itemId}:${limit}`;
"""
if old_r in s:
    s = s.replace(old_r, new_r)
    print("recommend keys")
p.write_text(s, encoding="utf-8")

p = ROOT / "apps/api/src/services/query-cache.ts"
s = p.read_text(encoding="utf-8")
old = """  public static invalidateNamespace(namespace?: string): void {
    if (!namespace || namespace === 'default:default') {
      ApiQueryCache.getInstance().invalidatePrefix('search:default:default:');
      ApiQueryCache.getInstance().invalidatePrefix('recommend:default:default:');
      getCache().invalidateNamespaceSync('default:default');
    } else {
      ApiQueryCache.getInstance().invalidatePrefix(`search:${namespace}:`);
      ApiQueryCache.getInstance().invalidatePrefix(`recommend:${namespace}:`);
      getCache().invalidateNamespaceSync(namespace);
    }
    ApiQueryCache.syncMetrics();
  }
"""
new = """  public static invalidateNamespace(namespace?: string): void {
    const ns = !namespace || namespace === 'default:default' ? 'default:default' : namespace;
    ApiQueryCache.getInstance().invalidatePrefix(`search:${ns}:`);
    ApiQueryCache.getInstance().invalidatePrefix(`recommend:${ns}:`);
    if (ns === 'default:default') {
      ApiQueryCache.getInstance().invalidatePrefix('search:');
      ApiQueryCache.getInstance().invalidatePrefix('recommend:');
    }
    getCache().invalidateNamespaceSync(ns);
    ApiQueryCache.syncMetrics();
  }
"""
if old in s:
    p.write_text(s.replace(old, new), encoding="utf-8")
    print("invalidate")
elif "const ns = !namespace" in s:
    print("invalidate already")
else:
    print("invalidate missing")
