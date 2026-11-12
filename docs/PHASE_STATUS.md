# EIDOS multi-phase execution status

Updated: 2026-11-12 (continue)

## Phase 0 — Revive main
| Item | Status |
|------|--------|
| resolveRequestStore | **DONE** |
| whenReady / wasEmptyBeforeRestore | **ON MAIN** (git show origin/main) |
| await whenReady in search/catalog | **DONE** |
| Typecheck workflow | **success** on main |
| Full CI unit tests | **failing** (coverage gate / suite) — investigate next |

## Phase 1 — Persistence
OPEN (WAL order structurally OK if snapshot callback awaits full write)

## Phase 2 — Honest search
| Item | Status |
|------|--------|
| HeuristicReranker alias | done earlier |
| ONNX env flag unify | **inject script** `inject_embedder_onnx_flag.py` |
| Prod default real model | OPEN |

## Phase 4 — Security
| Item | Status |
|------|--------|
| CORP widget.js | DONE |
| CORS no ai.studio | DONE |
| JWT ephemeral dev | **inject script** |
| REDIS compose | **DONE** `31011f5` |

## Phase 5 — Bitrix
| Mapper CFile + no __eidos tags | DONE |
| Delete hooks | OPEN |

## Blockers for pilot
1. Green `pnpm test` in main CI (not only typecheck)
2. Phase 1 crash-recovery verified
3. Bitrix delete sync
4. Honest README
