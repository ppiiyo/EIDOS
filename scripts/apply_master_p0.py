#!/usr/bin/env python3
"""Master P0 applicator — idempotent. Single canonical path for vector-store: git apply diff."""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def ok(m: str) -> None:
    print("  +", m)


def skip(m: str) -> None:
    print("  =", m)


def fail(m: str) -> bool:
    print("  !", m)
    return False


def run_git_apply(diff_rel: str) -> bool:
    diff = ROOT / diff_rel
    if not diff.is_file():
        return False
    check = subprocess.run(
        ["git", "apply", "--check", str(diff)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if check.returncode != 0:
        print("  ! git apply --check failed:\n", check.stderr or check.stdout)
        return False
    applied = subprocess.run(
        ["git", "apply", str(diff)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if applied.returncode != 0:
        print("  ! git apply failed:\n", applied.stderr or applied.stdout)
        return False
    return True


def _was_empty_inside_load_snapshot(s: str) -> bool:
    m = re.search(
        r"async\s+loadSnapshotFromDisk\s*\([\s\S]*?\)\s*:\s*Promise<number>\s*\{([\s\S]{0,8000})",
        s,
    )
    if not m:
        return False
    return "wasEmptyBeforeRestore" in m.group(1)


def patch_vector_store() -> None:
    p = ROOT / "apps/api/src/services/vector-store.ts"
    s = p.read_text(encoding="utf-8")

    if "public whenReady()" in s and "wasEmptyBeforeRestore" in s:
        if not _was_empty_inside_load_snapshot(s):
            fail("wasEmptyBeforeRestore present but NOT inside loadSnapshotFromDisk")
            return
        skip("vector-store P0 already applied")
        return

    if run_git_apply("patches/vector-store.p0.diff"):
        s2 = p.read_text(encoding="utf-8")
        if not _was_empty_inside_load_snapshot(s2):
            fail("diff applied but wasEmptyBeforeRestore not inside loadSnapshotFromDisk")
            return
        ok("vector-store via git apply patches/vector-store.p0.diff")
        return

    ok("falling back to surgical inject")
    changed = False

    if "public whenReady()" not in s:
        gate = (
            "  private readyPromise: Promise<void> = Promise.resolve();\n"
            "  public setReadyPromise(p: Promise<void>): void { this.readyPromise = p; }\n"
            "  public whenReady(): Promise<void> { return this.readyPromise; }\n\n"
        )
        m = re.search(r"(\n[ \t]*)(public[ \t]+async[ \t]+loadSnapshotFromDisk[ \t]*\()", s)
        if not m:
            fail("loadSnapshotFromDisk not found")
            return
        s = s[: m.start()] + "\n" + gate + m.group(1) + m.group(2) + s[m.end() :]
        changed = True
        ok("whenReady/setReadyPromise")

    if "wasEmptyBeforeRestore" not in s:
        pat = (
            r"(async\s+loadSnapshotFromDisk\s*\([\s\S]*?\)\s*:\s*Promise<number>\s*\{)\n"
            r"(\s*)(const hasExplicitEmbedder\s*=)"
        )
        repl = r"\1\n\2const wasEmptyBeforeRestore = this.items.size === 0;\n\2\3"
        s2, n = re.subn(pat, repl, s, count=1)
        if n != 1:
            fail("wasEmptyBeforeRestore method-scoped inject failed")
            return
        s = s2
        changed = True
        ok("wasEmptyBeforeRestore (method-scoped)")

    if "snapshotIds.size >= 100 && wasEmptyBeforeRestore" not in s:
        if "snapshotIds.size >= 100 && canUseFullBinaryRestore" in s:
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
            if not n:
                fail("purge pattern")
                return
            s = s2
            changed = True
            ok("purge wasEmptyBeforeRestore")

    if "offset + limit + 25" in s:
        s = s.replace("offset + limit + 25", "offset + limit + 50")
        changed = True
        ok("deep page +50")

    if changed:
        p.write_text(s, encoding="utf-8")
        if not _was_empty_inside_load_snapshot(s):
            fail("post-write check: wasEmptyBeforeRestore not inside loadSnapshotFromDisk")


def patch_server() -> None:
    p = ROOT / "apps/api/src/server.ts"
    s = p.read_text(encoding="utf-8")
    if "isSpaceMismatch" in s:
        skip("fail-closed")
        return
    pat = (
        r"catch \(err\) \{\s*console\.warn\(\s*"
        r"'\[EIDOS\] Skipping stale catalog snapshot on startup:',\s*"
        r"err instanceof Error \? err\.message : err\s*\);\s*\}"
    )
    repl = (
        "catch (err) {\n"
        "        const isSpaceMismatch =\n"
        "          (err as any)?.name === 'EmbeddingSpaceMismatchError' ||\n"
        "          /embedding space mismatch/i.test(String((err as any)?.message || err));\n"
        "        if (isSpaceMismatch) throw err;\n"
        "        console.warn('[EIDOS] Skipping stale catalog snapshot on startup:', "
        "err instanceof Error ? err.message : err);\n"
        "      }"
    )
    s2, n = re.subn(pat, repl, s, count=1)
    if n != 1:
        fail("server pattern")
        return
    p.write_text(s2, encoding="utf-8")
    ok("fail-closed")


def patch_registry() -> None:
    p = ROOT / "apps/api/src/services/store-registry.ts"
    s = p.read_text(encoding="utf-8")
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
            "    request?: FastifyRequest | { headers?: Record<string, unknown>; "
            "tenantId?: string; body?: unknown; query?: unknown },\n"
            "    options?: { createIfMissing?: boolean }\n"
            "  ): { store: VectorStore; tenantId: string; indexName: string; metadata: IndexMetadata } {\n"
            "    const tenantId = this.resolveTenantId(request);\n"
            "    const indexName = this.resolveIndexName(request);\n"
            "    const metadata = this.getMetadata(tenantId, indexName, options);\n"
            "    return { store: metadata.store, tenantId: metadata.tenantId, "
            "indexName: metadata.name, metadata };\n"
            "  }\n"
        )
        idx = s.rfind("\n}\n")
        if idx < 0:
            fail("class end")
            return
        s = s[:idx] + method + s[idx:]
        changed = True
        ok("resolveRequestStore")
    else:
        skip("resolveRequestStore")
    if "setReadyPromise" not in s:
        fail("setReadyPromise missing in registry")
        return
    if changed:
        p.write_text(s, encoding="utf-8")


def patch_ui() -> None:
    p = ROOT / "apps/workspace/src/pages/AdminConsolePage/EidosAdminConsole.tsx"
    if not p.exists():
        fail("UI missing")
        return
    s = p.read_text(encoding="utf-8")
    orig = s
    s = s.replace(
        "itemsIndexed: (mode || initialMode) === 'public-demo' ? 1048 : 0,",
        "itemsIndexed: 0,",
    )
    s = s.replace(
        "hnswIndexed: (mode || initialMode) === 'public-demo' ? 1048 : 0,",
        "hnswIndexed: 0,",
    )
    s = s.replace("itemsCount || 1048", "itemsCount || 0")
    s = re.sub(
        r"Math\.max\(\s*Number\(prev\?\.itemsIndexed\s*\?\?\s*0\)\s*,\s*1048\s*\)",
        "Number(prev?.itemsIndexed ?? 0)",
        s,
    )
    if s != orig:
        p.write_text(s, encoding="utf-8")
        ok("UI 1048")
    else:
        skip("UI 1048")


def patch_gate() -> None:
    p = ROOT / "packages/core/src/search/ranking-guardrails.ts"
    s = p.read_text(encoding="utf-8")
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
        skip("gate")
        return
    if old not in s:
        fail("gate pattern")
        return
    p.write_text(s.replace(old, new), encoding="utf-8")
    ok("gate EIDOS-104")


def patch_search() -> None:
    p = ROOT / "apps/api/src/routes/search.ts"
    s = p.read_text(encoding="utf-8")
    if "await activeStore.whenReady()" in s:
        skip("search whenReady")
        return
    old = (
        "        const resolved = storeRegistry.resolveRequestStore(request);\n"
        "        activeStore = resolved.store;"
    )
    new = old + "\n        await activeStore.whenReady();"
    if old not in s:
        fail("search pattern")
        return
    p.write_text(s.replace(old, new, 1), encoding="utf-8")
    ok("search whenReady")


def patch_catalog() -> None:
    p = ROOT / "apps/api/src/routes/catalog.ts"
    s = p.read_text(encoding="utf-8")
    if "await resolved.store.whenReady()" in s:
        skip("catalog whenReady")
        return
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
        "  async function resolveStore(request: any): "
        "Promise<{ store: VectorStore; tenantId: string; indexName: string }> {\n"
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
        fail("catalog pattern")
        return
    s = s.replace(old, new)
    s = re.sub(r"(?<!await )(?<!function )resolveStore\(", "await resolveStore(", s)
    s = s.replace("async function await resolveStore", "async function resolveStore")
    p.write_text(s, encoding="utf-8")
    ok("catalog whenReady")


if __name__ == "__main__":
    if not (ROOT / "package.json").exists():
        sys.exit("Run from repo root (or via scripts/ from package root)")
    print("EIDOS master P0 applicator (canonical git apply for vector-store)")
    patch_vector_store()
    patch_server()
    patch_registry()
    patch_ui()
    patch_gate()
    patch_search()
    patch_catalog()
    print("Done. Required: pnpm filters tsc + pnpm test")
