# Contributing to EIDOS

Thank you for your interest in contributing to EIDOS. We welcome contributions from developers, researchers, and technical writers.

---

## Code of Conduct

All contributors and maintainers are expected to follow our [Code of Conduct](./CODE_OF_CONDUCT.md).

---

## Development Setup

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/ppiiyo/EIDOS.git
   cd EIDOS
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Run the development server:
   ```bash
   pnpm dev
   ```
4. Run the test suite:
   ```bash
   pnpm test
   ```

---

## Branching & Commit Conventions

We enforce [Conventional Commits](https://www.conventionalcommits.org/):

* `feat(core): add MMR re-ranking algorithm`
* `fix(api): handle missing embedding field in catalog ingestion`
* `docs(readme): add benchmarks table`
* `perf(embedder): cache normalized query vectors`

---

## Pull Request Guidelines

1. Create a feature branch: `git checkout -b feat/your-feature-name`
2. Ensure all types compile: `pnpm lint`
3. Ensure all tests pass: `pnpm test`
4. Submit PR referencing relevant issues with descriptive summary and test notes
