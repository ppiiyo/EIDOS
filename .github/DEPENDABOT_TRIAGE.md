# Dependabot PR Triage Record (v3.5 Production Hardening)

This document records the automated dependency triage executed for **kostra44SIP v3.5**.

## 1. Closed Major Upgrades (Deferred to v4.0.0)

### Closed PRs: `#14` (TypeScript 5.8 → 7.0.2) & `#15` (Tailwind 3.4 → 4.3.3)

- **Action**: Closed with `@dependabot ignore this major version`
- **Closing Comment**:
  > `"Major upgrades scheduled for v4.0.0 to avoid breaking changes in v3.x series."`
- **Technical Rationale**:
  - `#14` (`typescript` 5.8 → 7.0.2): Major compiler jump deferred to v4.0.0 to preserve deterministic build stability across monorepo packages (`@kostra44sip/core`, `@kostra44sip/sdk`, `@kostra44sip/api`, `@kostra44sip/landing`).
  - `#15` (`tailwindcss` 3.4 → 4.3.3 in `@kostra44sip/landing`): Next.js 14.1.3 App Router relies on Tailwind v3 PostCSS directives (`@tailwind base/components/utilities`). Migrating to v4 is scheduled alongside Next.js 15 in v4.0.0.

---

## 2. Batch-Merged Safe PRs (`#1`, `#2`, `#3`, `#4`, `#5`)

| PR | Package / Action | Type | Status |
|:---|:---|:---|:---|
| `#1` | `actions/checkout`, `actions/cache`, `actions/setup-node` | GitHub Actions | ✅ Merged in batch |
| `#2` | `pnpm/action-setup`, `actions/deploy-pages` | GitHub Actions | ✅ Merged in batch |
| `#3` | `vitest`, `@vitest/coverage-v8`, `@playwright/test` | DevDependency (minor/patch) | ✅ Merged in batch |
| `#4` | `fastify`, `@fastify/cors`, `@fastify/rate-limit` | Runtime Dependency (patch) | ✅ Merged in batch |
| `#5` | `three`, `lucide-react`, `recharts` | UI Dependency (minor/patch) | ✅ Merged in batch |

- **Open PR Count**: `0` (≤ 5 target met)
- **Grouping Policy**: Configured in `.github/dependabot.yml` (`minor-and-patch` + `github-actions`).
