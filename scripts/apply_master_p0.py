#!/usr/bin/env python3
"""Master P0 applicator — idempotent. Caller+callee same apply; correct purge."""
from pathlib import Path
import re, sys

def ok(m): print("  +", m)
def skip(m): print("  =", m)
def fail(m):
    print("  !", m)
    return False

def patch_vector_store():
    p = Path("apps/api/src/services/vector-store.ts")
    s = p.read_text()
    changed = False

    if "public whenReady()" not in s:
        gate = (
            "  private readyPromise: Promise<void> = Promise.resolve();\n"
            "  public setReadyPromise(p: Promise<void>): void { this.readyPromise = p; }\n"
            "  public whenReady(): Promise<void> { return this.readyPromise; }\n\n"
        )
        m = re.search(r"(\n[ \t]*)(public[ \t]+async[ \t]+loadSnapshotFromDisk[ \t]*\()", s)
        if not m:
            return fail("loadSnapshotFromDisk not found")
        s = s[: m.start()] + "\n" + gate + m.group(1) + m.group(2) + s[m.end() :]
        changed = True
        ok("whenReady/setReadyPromise")
    else:
        skip("whenReady")

    # MUST use body anchor — first `{` after loadSnapshotFromDisk is a type-union param, not method body
    if "wasEmptyBeforeRestore" not in s:
        anchor = "  ): Promise<number> {\n    const hasExplicitEmbedder ="
        inject = (
            "  ): Promise<number> {\n"
            "    const wasEmptyBeforeRestore = this.items.size === 0;\n"
            "    const hasExplicitEmbedder ="
        )
        if anchor not in s:
            return fail("wasEmptyBeforeRestore body anchor not found")
        s = s.replace(anchor, inject, 1)
        changed = True
        ok("wasEmptyBeforeRestore")
    else:
        skip("wasEmptyBeforeRestore")

    if "snapshotIds.size >= 100 && wasEmptyBeforeRestore" in s:
        skip("purge guard")
    elif "snapshotIds.size >= 100 && canUseFullBinaryRestore" in s:
        s = s.replace(
            "if (snapshotIds.size >= 100 && canUseFullBinaryRestore) {",
            "if (snapshotIds.size >= 100 && wasEmptyBeforeRestore) {",
        )
        changed = True
        ok("purge: canUseFullBinaryRestore -> wasEmptyBeforeRestore")
    else:
        s2, n = re.subn(
            r"if\s*\(\s*snapshotIds\.size\s*>=\s*100\s*\)\s*\{",
            "if (snapshotIds.size >= 100 && wasEmptyBeforeRestore) {",
            s,
            count=1,
        )
        if n:
            s = s2
            changed = True
            ok("purge wasEmptyBeforeRestore")
        else:
            fail("purge pattern")

    if "offset + limit + 25" in s:
        s = s.replace("offset + limit + 25", "offset + limit + 50")
        changed = True
        ok("deep page +50")

    if changed:
        p.write_text(s)

def patch_server():
    p = Path("apps/api/src/server.ts")
    s = p.read_text()
    if "isSpaceMismatch" in s:
        return skip("fail-closed")
    pat = r"catch \(err\) \{\s*console\.warn\(\s*'\[EIDOS\] Skipping stale catalog snapshot on startup:',\s*err instanceof Error \? err\.message : err\s*\);\s*\}"
    repl = (
        "catch (err) {\n"
        "        const isSpaceMismatch =\n"
        "          (err as any)?.name === 'EmbeddingSpaceMismatchError' ||\n"
        "          /embedding space mismatch/i.test(String((err as any)?.message || err));\n"
        "        if (isSpaceMismatch) throw err;\n"
        "        console.warn('[EIDOS] Skipping stale catalog snapshot on startup:', err instanceof Error ? err.message : err);\n"
        "      }"
    )
    s2, n = re.subn(pat, repl, s, count=1)
    if n != 1:
        return fail("server pattern")
    p.write_text(s2)
    ok("fail-closed")

def patch_registry():
    p = Path("apps/api/src/services/store-registry.ts")
    s = p.read_text()
    changed = False
    if "`eidos-demo-${process.pid}`" in s:
        s = s.replace(
            "path.join(os.tmpdir(), `eidos-demo-${process.pid}`, indexName)",
            "path.join(os.tmpdir(), 'eidos-demo', indexName)",
        )
        changed = True
        ok("stable demo path")
    else:
        skip("demo path")
    if "resolveRequestStore" not in s:
        method = (
            "\n  public resolveRequestStore(\n"
            "    request?: FastifyRequest | { headers?: Record<string, unknown>; tenantId?: string; body?: unknown; query?: unknown },\n"
            "    options?: { createIfMissing?: boolean }\n"
            "  ): { store: VectorStore; tenantId: string; indexName: string; metadata: IndexMetadata } {\n"
            "    const tenantId = this.resolveTenantId(request);\n"
            "    const indexName = this.resolveIndexName(request);\n"
            "    const metadata = this.getMetadata(tenantId, indexName, options);\n"
            "    return { store: metadata.store, tenantId: metadata.tenantId, indexName: metadata.name, metadata };\n"
            "  }\n"
        )
        idx = s.rfind("\n}\n")
        if idx < 0:
            return fail("class end")
        s = s[:idx] + method + s[idx:]
        changed = True
        ok("resolveRequestStore")
    else:
        skip("resolveRequestStore")
    if "setReadyPromise" not in s:
        return fail("setReadyPromise missing in registry")
    if changed:
        p.write_text(s)

def patch_ui():
    p = Path("apps/workspace/src/pages/AdminConsolePage/EidosAdminConsole.tsx")
    if not p.exists():
        return fail("UI missing")
    s = p.read_text()
    orig = s
    s = s.replace("itemsIndexed: (mode || initialMode) === 'public-demo' ? 1048 : 0,", "itemsIndexed: 0,")
    s = s.replace("hnswIndexed: (mode || initialMode) === 'public-demo' ? 1048 : 0,", "hnswIndexed: 0,")
    s = s.replace("itemsCount || 1048", "itemsCount || 0")
    s = re.sub(
        r"Math\.max\(\s*Number\(prev\?\.itemsIndexed\s*\?\?\s*0\)\s*,\s*1048\s*\)",
        "Number(prev?.itemsIndexed ?? 0)",
        s,
    )
    if s != orig:
        p.write_text(s)
        ok("UI 1048")
    else:
        skip("UI 1048")

def patch_gate():
    p = Path("packages/core/src/search/ranking-guardrails.ts")
    s = p.read_text()
    old = (
        "  const activeFamilies: ReadonlyArray<CategoryFamilySpec> =\n"
        "    customFamilies && customFamilies.length > 0\n"
        "      ? [...customFamilies, ...PRODUCT_CATEGORY_FAMILIES]\n"
        "      : PRODUCT_CATEGORY_FAMILIES;"
    )
    new = (
        "  // EIDOS-104: prefer caller families.\n"
        "  const activeFamilies: ReadonlyArray<CategoryFamilySpec> =\n"
        "    customFamilies && customFamilies.length > 0\n"
        "      ? customFamilies\n"
        "      : PRODUCT_CATEGORY_FAMILIES;"
    )
    if "prefer caller families" in s:
        return skip("gate")
    if old not in s:
        return fail("gate pattern")
    p.write_text(s.replace(old, new))
    ok("gate EIDOS-104")

def patch_search():
    p = Path("apps/api/src/routes/search.ts")
    s = p.read_text()
    if "await activeStore.whenReady()" in s:
        return skip("search whenReady")
    old = (
        "        const resolved = storeRegistry.resolveRequestStore(request);\n"
        "        activeStore = resolved.store;"
    )
    new = old + "\n        await activeStore.whenReady();"
    if old not in s:
        return fail("search pattern")
    p.write_text(s.replace(old, new, 1))
    ok("search whenReady")

def patch_catalog():
    p = Path("apps/api/src/routes/catalog.ts")
    s = p.read_text()
    if "await resolved.store.whenReady()" in s:
        return skip("catalog whenReady")
    old = (
        "  function resolveStore(request: any): { store: VectorStore; tenantId: string; indexName: string } {\n"
        "    const resolved = storeRegistry.resolveRequestStore(request);\n"
        "    return {\n"
        "      store: resolved.store,\n"
        "      tenantId: resolved.tenantId,\n"
        "      indexName: resolved.indexName,\n"
        "    };\n"
        "  }"
    )
    new = (
        "  async function resolveStore(request: any): Promise<{ store: VectorStore; tenantId: string; indexName: string }> {\n"
        "    const resolved = storeRegistry.resolveRequestStore(request);\n"
        "    await resolved.store.whenReady();\n"
        "    return {\n"
        "      store: resolved.store,\n"
        "      tenantId: resolved.tenantId,\n"
        "      indexName: resolved.indexName,\n"
        "    };\n"
        "  }"
    )
    if old not in s:
        return fail("catalog pattern")
    s = s.replace(old, new)
    s = re.sub(r"(?<!await )(?<!function )resolveStore\(", "await resolveStore(", s)
    s = s.replace("async function await resolveStore", "async function resolveStore")
    p.write_text(s)
    ok("catalog whenReady")

if __name__ == "__main__":
    if not Path("package.json").exists():
        sys.exit("Run from repo root")
    print("EIDOS master P0 applicator (caller+callee, correct purge)")
    patch_vector_store()
    patch_server()
    patch_registry()
    patch_ui()
    patch_gate()
    patch_search()
    patch_catalog()
    print("Done. Required: pnpm -r exec tsc --noEmit && pnpm test")
