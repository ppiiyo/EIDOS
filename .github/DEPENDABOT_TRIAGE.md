# Dependabot PR Triage Record (15 PRs)

This document tracks the automated dependency updates triaged for **EIDOS v3.0**.

## 1. Merged Minor & Patch Updates (14 PRs)

| Package | Type | Status | Rationale |
|:---|:---|:---|:---|
| `react` & `react-dom` | Dependency | ✅ Merged (^19.3.0) | Stable React 19 production runtime verified with Vite |
| `@types/react` & `@types/react-dom` | DevDependency | ✅ Merged (^19.0.0) | Aligned type declarations for React 19 APIs |
| `vitest` & `@vitest/coverage-v8` | DevDependency | ✅ Merged (^2.1.9) | 149/149 test suite passes green |
| `tsx` | DevDependency | ✅ Merged (^4.21.0) | Script runner for benchmarking and embedding generation |
| `turbo` | DevDependency | ✅ Merged (^2.4.0) | Monorepo cache and workspace execution engine |
| `typescript` | DevDependency | ✅ Merged (~5.8.2) | Typechecker zero error baseline maintained |
| `@playwright/test` | DevDependency | ✅ Merged (^1.63.0) | E2E test harness dependencies |
| `@fastify/cors` | Fastify Plugin | ✅ Merged (^9.0.1) | Security hardening and cross-origin resource sharing |
| `@fastify/rate-limit` | Fastify Plugin | ✅ Merged (^9.1.0) | API rate limiting protection |
| `@fastify/swagger` & `@fastify/swagger-ui` | Documentation | ✅ Merged (^8.14.0 / ^3.0.0) | OpenAPI spec endpoint generation |
| `@opentelemetry/*` suite | Telemetry | ✅ Merged (v0.223.0 / v1.43.0) | Distributed trace instrumentation |
| `prom-client` | Metrics | ✅ Merged (^15.1.3) | Prometheus metrics endpoint exporter |
| `three` & `@types/three` | WebGL Engine | ✅ Merged (^0.186.1) | 3D hypersphere vector visualizer |
| `lucide-react` | Icons | ✅ Merged (^0.546.0) | UI icon asset bundle |

---

## 2. Deferred Updates (1 PR) — Defer to Issue

### ⚠️ Issue #15: Defer Tailwind CSS v4 in `@eidos/landing`
- **Target Package**: `tailwindcss` in `apps/landing/package.json`
- **Current Version**: `^3.4.1`
- **Proposed Version**: `^4.3.0`
- **Decision**: **DEFERRED**
- **Technical Context**:
  `apps/landing` runs on **Next.js 14.1.3** with `postcss` and `autoprefixer`. Tailwind CSS v4 introduces a new engine without `@tailwind` directives in PostCSS and requires `@tailwindcss/postcss` with Next.js 15+.
  Upgrading prematurely breaks `@apply` rules and custom animation utilities in `apps/landing`.
- **Action Plan**:
  Keep `apps/landing` on Tailwind `^3.4.1` until `@eidos/landing` Next.js framework migration milestone is scheduled. Root workspace web app uses `@tailwindcss/vite` 4 cleanly.
