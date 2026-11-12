# EIDOS phase status

## Done on main
- Phase 0: resolveRequestStore, whenReady, wasEmptyBeforeRestore, search/catalog await
- Phase 1 (partial): inject WAL checkpoint → saveSnapshotSync (durable before truncate)
- Phase 2 (partial): isOnnxEmbedderEnabled fixed; HeuristicReranker alias
- Phase 4: CORP widget, CORS, JWT ephemeral, REDIS compose, demo mutations gate (inject)
- Phase 5: Mapper CFile + no __eidos tags; installer Delete/Update events; Connector delete hooks (inject)

## Open
- CI unit suite green (coverage/gate)
- Full ONNX default in production
- SingleFlight total/facets
- Crash-recovery automated test evidence
- README honesty pass
- Widget dual-copy permanently unified in build pipeline

## Pilot readiness
**Not yet.** Need green `pnpm test` + verified restart AC on real tenant data.
