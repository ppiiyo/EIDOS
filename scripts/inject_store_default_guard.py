#!/usr/bin/env python3
"""Do not replace a populated default store with an empty one (multi buildServer in tests)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "apps/api/src/services/store-registry.ts"
s = p.read_text(encoding="utf-8")
if "Second buildServer" in s:
    print("already")
    raise SystemExit(0)
old = """  public setDefaultStore(store: VectorStore): void {
    const key = StoreRegistry.makeKey('default', 'default');
    const existing = this.stores.get(key);
    this.stores.set(key, {
"""
new = """  public setDefaultStore(store: VectorStore): void {
    const key = StoreRegistry.makeKey('default', 'default');
    const existing = this.stores.get(key);
    // Second buildServer() in tests must not wipe a populated default catalog with an empty store.
    if (existing && existing.store.count() > 0 && store.count() === 0) {
      return;
    }
    this.stores.set(key, {
"""
if old not in s:
    raise SystemExit("pattern missing")
p.write_text(s.replace(old, new), encoding="utf-8")
print("written")
