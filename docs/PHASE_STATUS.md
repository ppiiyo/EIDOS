# EIDOS multi-phase execution status

Updated: 2026-11-12

## Phase 0 — Revive main
| Item | Status |
|------|--------|
| resolveRequestStore | **DONE** `b2546b7` |
| whenReady on VectorStore | **CI auto-apply** workflow `auto-apply-p0.yml` + `scripts/inject_when_ready.py` |
| fail-closed embedding space | **DONE** |
| Remove hotfix scripts | After whenReady lands in tree |

**Action:** Open Actions → *Auto-apply VectorStore P0 on push* → ensure green commit with `whenReady`.

## Phase 1 — Persistence
OPEN. WAL truncate-after-callback structure OK if `saveSnapshotAsync` fully awaits write (verify next).

## Phase 2 — Honest search
PARTIAL: `HeuristicReranker` alias added; ONNX default + concept-cluster cleanup still OPEN.

## Phase 3 — Cache/pagination
OPEN.

## Phase 4 — Security
| Item | Status |
|------|--------|
| CORS without ai.studio default | **DONE** `08e4998` |
| CORP cross-origin for /widget.js | **DONE** `08e4998` |
| JWT no fixed dev secret | local patch ready (auth.ts) — push pending size |
| Demo endpoints feature-flag | OPEN |

## Phase 5 — Bitrix / widget
| Item | Status |
|------|--------|
| Mapper CFile class_exists + is_callable | **DONE** `5a9c396` |
| Drop __eidos_* meta tags from tags | **DONE** `5a9c396` |
| widget data-product-url-template | local |
| dual widget.js | OPEN |
| delete hooks / reconcile | OPEN |

## Phases 6–9
Not started until Phase 0 typecheck green.

## Honest readiness
**Not production-ready for client pilots yet.** Blocking: whenReady on main, green `pnpm test`, crash-recovery, Bitrix delete sync, honest embedder path.
