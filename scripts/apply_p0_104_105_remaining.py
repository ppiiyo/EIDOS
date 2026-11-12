#!/usr/bin/env python3
"""Apply remaining P0 + EIDOS-104/105. Run from repo root after git pull."""
from pathlib import Path
import re

def patch_vector_store_ready():
    p = Path('apps/api/src/services/vector-store.ts')
    s = p.read_text()
    if 'public whenReady()' in s:
        print('= vector-store whenReady already')
        return
    gate = (
        "  private readyPromise: Promise<void> = Promise.resolve();\n"
        "  public setReadyPromise(p: Promise<void>): void { this.readyPromise = p; }\n"
        "  public whenReady(): Promise<void> { return this.readyPromise; }\n\n"
    )
    pat = r'(\n[ \t]*)(public[ \t]+async[ \t]+loadSnapshotFromDisk[ \t]*\()'
    m = list(re.finditer(pat, s))
    if len(m) != 1:
        print('! vector-store loadSnapshotFromDisk pattern not found', len(m))
        return
    s = re.sub(pat, lambda m: '\n' + gate + m.group(1) + m.group(2), s, count=1)
    p.write_text(s)
    print('+ vector-store whenReady/setReadyPromise')

def patch_server():
    p = Path('apps/api/src/server.ts')
    s = p.read_text()
    if 'isSpaceMismatch' in s:
        print('= server fail-closed already')
        return
    pat = r"catch \(err\) \{\s*console\.warn\(\s*'\[EIDOS\] Skipping stale catalog snapshot on startup:',\s*err instanceof Error \? err\.message : err\s*\);\s*\}"
    repl = """catch (err) {
        const isSpaceMismatch =
          (err as any)?.name === 'EmbeddingSpaceMismatchError' ||
          /embedding space mismatch/i.test(String((err as any)?.message || err));
        if (isSpaceMismatch) throw err;
        console.warn('[EIDOS] Skipping stale catalog snapshot on startup:', err instanceof Error ? err.message : err);
      }"""
    s2, n = re.subn(pat, repl, s, count=1)
    if n != 1:
        print('! server pattern not found')
        return
    p.write_text(s2)
    print('+ server fail-closed')

def patch_gate_merge():
    p = Path('packages/core/src/search/ranking-guardrails.ts')
    if not p.exists():
        print('! ranking-guardrails missing')
        return
    s = p.read_text()
    old = """  const activeFamilies: ReadonlyArray<CategoryFamilySpec> =
    customFamilies && customFamilies.length > 0
      ? [...customFamilies, ...PRODUCT_CATEGORY_FAMILIES]
      : PRODUCT_CATEGORY_FAMILIES;"""
    new = """  // EIDOS-104: prefer caller families (dynamic catalog + tenant). Demo preset is fallback only.
  const activeFamilies: ReadonlyArray<CategoryFamilySpec> =
    customFamilies && customFamilies.length > 0
      ? customFamilies
      : PRODUCT_CATEGORY_FAMILIES;"""
    if 'prefer caller families' in s:
        print('= gate merge already')
        return
    if old not in s:
        print('! gate merge pattern not found')
        return
    p.write_text(s.replace(old, new))
    print('+ gate merge EIDOS-104')

def patch_deep_page():
    p = Path('apps/api/src/services/vector-store.ts')
    s = p.read_text()
    if 'offset + limit + 50' in s:
        print('= deep page headroom already')
        return
    if 'offset + limit + 25' not in s:
        print('! deep page pattern not found')
        return
    p.write_text(s.replace('offset + limit + 25', 'offset + limit + 50'))
    print('+ deep pagination headroom +50')

if __name__ == '__main__':
    patch_vector_store_ready()
    patch_server()
    patch_gate_merge()
    patch_deep_page()
    print('Done. Review diff, run tests, commit.')
