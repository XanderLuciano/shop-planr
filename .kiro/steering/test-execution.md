---
inclusion: auto
description: "How to run tests and read output without re-running or losing data. Canonical grep patterns for vitest."
---

# Test Execution Rules

## MANDATORY — Read This First

You MUST use the EXACT commands in this file when running tests. Copy-paste them. Do NOT:

- Invent your own grep pattern (e.g., `grep -E "^( Test Files| Tests  )"` — WRONG, anchored `^` breaks on vitest output)
- Use `npm run test` or `npm test` instead of `npx vitest run`
- Omit the `2>&1` redirect (stderr contains test output)
- Change `head -200` to a different limit
- Add `--reporter=verbose` on full-suite or folder runs
- Pipe through `tail` instead of the canonical grep for multi-file runs

If you deviate from these commands, you WILL get incomplete or misleading output and waste time re-running. The patterns below have been tested against real output from this project. Trust them.

## The Problem

Vitest output includes noisy migration lines (`Migration N: ... — applied`) repeated per test file, plus verbose per-test lines. Naive `grep` or `tail` misses failures, and the AI ends up re-running the full suite 3-4 times trying different filters. Stop that.

## Canonical Commands

Use these EXACT commands. Do not improvise grep patterns.

### Run all tests (single pass)

```bash
npx vitest run 2>&1 | grep -E "(✓|×|❯|Test Files|Tests  |Start at|Duration|FAIL|AssertionError|Error:|Expected:|Received:|Timed out|→)" | head -200
```

### Run a specific folder

```bash
npx vitest run tests/properties/ 2>&1 | grep -E "(✓|×|❯|Test Files|Tests  |Start at|Duration|FAIL|AssertionError|Error:|Expected:|Received:|Timed out|→)" | head -200
```

### Run a single file

```bash
npx vitest run tests/properties/roundTrip.property.test.ts 2>&1 | tail -40
```

For single files, `tail -40` is fine — the output is small enough. For folders or full suite, always use the grep pattern.

### When a test fails and you need the full error

Run the single failing file with `--reporter=verbose` and `tail -80`:

```bash
npx vitest run tests/properties/FAILING_FILE.property.test.ts --reporter=verbose 2>&1 | tail -80
```

## What the grep catches

The patterns are NOT anchored with `^` because vitest output has leading whitespace and unicode control characters. The grep matches anywhere in the line.

| Pattern | What it matches |
|---------|----------------|
| `✓` | Passed test (unicode checkmark) |
| `×` | Failed test (unicode ×) |
| `❯` | Running/queued test suite |
| `Test Files` | Summary: `Test Files  6 failed \| 13 passed (273)` |
| `Tests  ` | Summary: `Tests  6 failed \| 60 passed (70)` — note the two spaces to avoid matching file paths like `tests/properties/...` |
| `Start at` | Timestamp |
| `Duration` | Total duration |
| `FAIL` | Failure header |
| `AssertionError` | Assertion details |
| `Error:` | Error message |
| `Expected:` | Expected value in diff |
| `Received:` | Received value in diff |
| `Timed out` | Timeout message |
| `→` | Vitest error pointer (e.g., `→ Test timed out in 5000ms.`) |

## What the grep filters OUT

- `Migration N: ... — applied` lines (the main noise source — these contain none of the patterns above)
- `stdout |` prefixed lines (unless they also contain an error keyword)
- Blank lines
- Stack traces (file paths) — if you need these, re-run the single failing file

## Failure Drill-Down Workflow

The canonical grep output contains file paths in two places:

- `❯ tests/properties/foo.property.test.ts (2 tests | 1 failed)` — the suite summary line
- `FAIL  tests/properties/foo.property.test.ts > Test Name` — the per-failure detail block

When the grep shows failures:

1. Scan the `❯` lines for any that say `failed` — these are the failing files.
2. Pick the FIRST failing file and re-run it alone: `npx vitest run tests/properties/foo.property.test.ts 2>&1 | tail -80`
3. Read the full error output (assertion diff, stack trace, timeout message).
4. Fix the issue, then re-run that single file to confirm.
5. Repeat for the next failing file.

Do NOT re-run the entire suite or folder to check if one file is fixed. Run the single file.

## Rules

1. NEVER run the full suite (`npm run test`) just to check one area. Run the specific folder or file.
2. NEVER pipe vitest output through multiple different greps hoping to catch more. Use the canonical grep above — it's been tested against real output.
3. If the grep output shows failures, follow the Failure Drill-Down Workflow above. Do not re-run the entire suite.
4. Do not use `--reporter=verbose` on folder-level or full-suite runs — it makes the output enormous. Only use it on single files when debugging a failure.
5. The `head -200` cap prevents runaway output. If you're hitting it, you have too many failures — focus on one file at a time.
6. Property tests use `fast-check` and can be slow (5-10s each). Set `timeout: 120000` on the vitest run if you're seeing timeout failures on property tests.
7. These commands are NOT suggestions. They are the ONLY way to run tests in this project. If you think you have a better grep pattern — you don't. Use the ones above.
