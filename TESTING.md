# Testing Standards

This document defines how we test Shop Planr. Read it before adding or
modifying any test. AI agents: treat this as durable instruction — don't
deviate without explicit owner approval.

## Scope by test type

The codebase uses four test layers. Each layer has a clear purpose; duplicate
coverage across layers is waste.

| Layer            | Framework            | Location                    | What it validates                                                                 |
|------------------|----------------------|-----------------------------|------------------------------------------------------------------------------------|
| Unit             | Vitest               | `tests/unit/`               | Pure functions, utils, schema validation, isolated composables.                   |
| Integration      | Vitest + SQLite      | `tests/integration/`        | Service-layer flows against in-memory SQLite — full repo → service wiring.        |
| Property-based   | Vitest + fast-check  | `tests/properties/`         | Invariants: idempotence, round-trips, ordering, non-negative counts.              |
| End-to-end (e2e) | Playwright + Chromium| `tests/e2e/`                | Business-critical user flows through the real UI and real HTTP stack.             |

If a behavior can be verified at a lower layer, it belongs there. e2e is
reserved for the handful of flows where UI wiring is itself the risk.

## E2E scope — what we do and do not test

The e2e suite is deliberately small. It covers **only** the flows a regression
would take the product offline:

- **Auth**: PIN setup, PIN login, switch user, log out.
- **Job/path creation**: admin creates a job and adds paths.
- **Parts**: create parts on a first step, advance parts between steps, skip
  an optional step.
- **Deletion**: admin deletes a path (empty + cascade), admin deletes a part.
- **Access control**: non-admin users don't see creative/destructive buttons.

**Out of scope for e2e** — covered elsewhere:

- Validation error messages (unit tests on services/schemas).
- Algorithms (property tests: advancement, distribution, grouping).
- Multi-service workflows without UI branches (integration tests).
- Visual regressions (use `npm run screenshots` for manual diffing).
- Edge cases, error paths, retry logic, rate limiter behavior.

**When adding an e2e test, ask: "If this breaks, can the app still ship?"** If
the answer is yes, put it in a lower layer.

## Running tests

```bash
npm run test              # Vitest: unit + integration + properties
npm run test:watch        # Vitest in watch mode
npm run test:e2e          # Playwright, headless
npm run test:e2e:ui       # Playwright UI mode (interactive)
npm run test:e2e:headed   # Watch the browser drive the UI
npm run test:e2e:debug    # Step through with inspector
```

E2E runs against a dedicated DB: `./data/test.db`. The `global-setup` step
deletes and re-seeds it before every run so tests start from a known state.
Your dev DB (`./data/shop_erp.db`) is never touched.

## E2E fixtures

Use the shared fixtures in `tests/e2e/fixtures.ts` — don't roll your own
auth.

```ts
import { test, expect } from './fixtures'

test('something', async ({ adminPage })      => { /* ... */ })  // signed in as SAMPLE-Sarah (admin)
test('something', async ({ operatorPage })   => { /* ... */ })  // signed in as SAMPLE-Mike  (non-admin)
test('something', async ({ page, signInAs }) => {               // sign in mid-test
  await signInAs('admin')
})
```

## Standards for writing e2e tests

1. **One behavior per test.** A test should fail for exactly one reason. If
   you find yourself asserting 5 unrelated things, split the test.

2. **Set up preconditions via the API, not the UI.** UI setup is slow and
   couples the test to unrelated flows. Only drive the UI for the behavior
   you're actually validating.

   ```ts
   // Good — API setup, UI for the thing under test:
   const api = await apiAs(baseURL!, 'admin')
   const { path } = await seedJobWithParts(api, { ... })
   await adminPage.goto(`/jobs/${path.jobId}`)
   await adminPage.getByRole('button', { name: 'Delete path' }).click()

   // Bad — UI setup:
   await adminPage.goto('/jobs/new')
   await adminPage.getByTestId('job-name-input').fill(...)
   // ... 20 more UI steps just to reach the delete button
   ```

3. **Prefer user-facing selectors over testids.** In order of preference:
   `getByRole` → `getByLabel` → `getByText` → `getByTestId`. Only add a
   `data-testid` when:
   - multiple elements share the same role/text (disambiguation),
   - the element has no accessible name (a blank icon button),
   - the test would otherwise depend on copy that's likely to change.

4. **Always use Playwright's web-first assertions.** `await expect(...)` auto-
   retries. Never use `.evaluate()` to read state you could assert on, and
   never `waitForTimeout(N)` as a stand-in for a real wait.

5. **Dev-server pages are slow. Wait for `networkidle` once after
   navigation, then rely on auto-waiting assertions** with a 10–20s timeout
   for the first meaningful-paint. Don't sprinkle timeouts everywhere.

6. **Keep selectors local.** Put testids on the component the test exercises,
   not in a shared constants file. If a testid name shows up in more than 3
   test files, you probably have a page-object opportunity — talk to the
   owners before refactoring.

7. **Don't assume ordering.** Tests run with `workers: 1` and a fresh DB per
   run, but can be re-ordered by `--shard` or `--grep`. Never rely on data a
   prior test created; create what you need.

8. **Reserved seed users.** `SAMPLE-Sarah` (admin) and `SAMPLE-Mike`
   (operator) are used by the fixtures — don't mutate their state (rename,
   deactivate, etc.) from within a test. `SAMPLE-Tony` is reserved as the
   "no-PIN-yet" user for the PIN-setup test. `SAMPLE-Lisa` is a free user
   for custom flows.

9. **Tolerate Nuxt UI toasts.** Toast text appears in several DOM nodes
   (title, description, sr-only alert). Use `.first()` or target a more
   specific element to avoid strict-mode violations.

10. **Never add delays to make tests "stable".** Flakes are always a signal:
    missing await, missing wait for a condition, race with a background
    fetch. Fix the root cause.

## Standards for Vitest tests

1. **Unit tests go in `tests/unit/` mirroring the source tree.** One file per
   source file: `server/utils/validation.ts` → `tests/unit/utils/validation.test.ts`.

2. **Integration tests use `createTestContext()` from `tests/integration/helpers.ts`.**
   Each test gets a fresh in-memory SQLite DB with migrations applied. Call
   `cleanup()` in `afterEach`/`afterAll`.

3. **Property tests live in `tests/properties/`.** Use `fast-check` for
   invariants. Keep arbitraries small and readable; don't model the whole
   domain — just what the property needs.

4. **Don't mock business logic.** Integration tests run real services
   against real repositories. Mock only external boundaries (Jira HTTP,
   filesystem, clock when order matters).

5. **Test names describe behavior, not implementation.** Read as a sentence:
   `it('rejects advancement when part is scrapped')`, not
   `it('advancePart returns error')`.

## When to add a test

| Change                                | Test layer                         |
|---------------------------------------|------------------------------------|
| New pure function / utility           | Unit                               |
| New Zod schema / validator            | Unit (schema) + property (round-trip)|
| New service method                    | Unit + integration for key flows   |
| New API route                         | Unit (route handler) + integration if non-trivial business logic |
| New domain invariant                  | Property                           |
| New component with logic              | Unit (component test via happy-dom)|
| New page — first time flow exists     | Consider 1 e2e happy-path test     |
| Bug fix                               | Regression test at the layer where the bug lived |
| Refactor with no behavior change      | No new test — existing tests should still pass |

## When **not** to add an e2e test

- The flow is already covered by a service-level integration test.
- You're validating a validation error message, tooltip, or one-off copy.
- The UI state is already asserted in a component-level unit test.
- The feature is behind a feature flag and isn't on by default.
- You want to "be safe". Safety comes from the right test at the right layer —
  e2e is expensive and flaky. Use it sparingly.

## Running CI

- **`ci.yml`** — lint, typecheck, `npm run test`. Runs on every PR.
- **`e2e.yml`** — Playwright suite. Opt-in via the `run-e2e` PR label, or
  trigger manually via `workflow_dispatch`. Don't make this required on every
  PR; the flake/cost ratio isn't worth it.

## Debugging a failing e2e test

1. Re-run with `npm run test:e2e:headed` to watch the browser.
2. Check `test-results/<test-name>/` for screenshot, trace, and
   `error-context.md` (DOM snapshot at failure).
3. Open the trace: `npx playwright show-trace test-results/<test-name>/trace.zip`.
4. If it's truly flaky (passes sometimes), treat it as a bug and fix the
   root cause. Don't add retries to mask it.
