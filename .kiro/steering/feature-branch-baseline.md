---
inclusion: always
---

# Feature Branch Baseline: Test & Lint Health

## Rule

Before writing any spec documents or implementation code on a new feature branch, you MUST establish a baseline by running the full test suite and linter. Any pre-existing failures must be understood, documented, and accounted for throughout the spec and implementation.

## Steps

### 1. Run the full test suite

```bash
npm run test -- --run
```

Capture the summary: total test files, passing tests, failing tests, and the names of any failing files.

### 2. Run the linter

```bash
npm run lint
```

Capture any errors or warnings.

### 3. Classify failures

For each failing test or lint error, determine:

- **Pre-existing** — existed on `main` before this branch, unrelated to the new work. Document these so they are not confused with regressions introduced by the feature.
- **Blocking** — must be fixed before the feature can be implemented correctly (e.g., a broken migration test that would mask new migration failures).
- **Ignorable** — known infrastructure issues (e.g., a missing optional dependency like `jose` that only affects auth-related tests) that do not affect the feature being built.

### 4. Record the baseline in the spec

Add a **Baseline Test Health** section to the spec's `requirements.md` or `design.md` that lists:

- Total passing tests at branch start
- Any pre-existing failures with a one-line explanation of why they are safe to ignore
- Any blocking failures that were fixed before implementation began

Example:

```markdown
## Baseline Test Health

Captured at branch creation (`feat/job-tags`):

- **Passing**: 1279 tests across 189 files
- **Pre-existing failures (4 files)**: All caused by `jose` ESM import resolution in Vitest — affects `authService.test.ts`, `pinJwtVerify.property.test.ts`, `workQueue.test.ts`, `pinValidation.test.ts`. Unrelated to this feature; safe to ignore.
- **Lint**: Clean at branch start
```

### 5. Keep the baseline in mind during implementation

- New test failures introduced by your changes are regressions — fix them before merging.
- Pre-existing failures listed in the baseline are expected and do not block the PR.
- The final checkpoint task in the spec should verify that the passing test count has increased (new tests added) and no new failures have appeared beyond the baseline.

## Why This Matters

Without a baseline, it is impossible to distinguish between:
- A test that was already broken before you started
- A test you accidentally broke with your changes

Establishing the baseline at branch creation makes the difference obvious and keeps the PR review clean.
