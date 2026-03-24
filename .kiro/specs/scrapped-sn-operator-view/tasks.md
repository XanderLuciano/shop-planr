# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Scrapped Serials Returned by listByStepIndex
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate scrapped serials appear in `listByStepIndex` results
  - **Scoped PBT Approach**: Scope the property to concrete failing cases — create serials, scrap some, then assert `listByStepIndex` excludes them
  - Create a test file `tests/properties/scrappedSnStepQuery.property.test.ts`
  - Use `createTestContext()` from `tests/integration/helpers.ts` for isolated in-memory DB
  - Test scenario: create job + path + serials → scrap one or more → call `repos.serials.listByStepIndex(pathId, stepIndex)` → assert no returned serial has `status = 'scrapped'`
  - Use `fast-check` to generate varying counts of serials (1–5) and randomly choose which to scrap
  - The test assertions match Expected Behavior Property 1 from design: `listByStepIndex` SHALL NOT include serials with `status = 'scrapped'`
  - Bug Condition from design: `isBugCondition(input)` where `serial.pathId = pathId AND serial.currentStepIndex = stepIndex AND serial.status = 'scrapped'`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists because scrapped serials are returned)
  - Document counterexamples found (e.g., "listByStepIndex returns serial with status='scrapped' at the queried step")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 2.1_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Scrapped Serials Unchanged by listByStepIndex
  - **IMPORTANT**: Follow observation-first methodology
  - Create preservation tests in the same file `tests/properties/scrappedSnStepQuery.property.test.ts`
  - Use `createTestContext()` for isolated in-memory DB
  - Observe on UNFIXED code: `in_progress` serials at a step are returned by `listByStepIndex`
  - Observe on UNFIXED code: steps with no matching serials return an empty list
  - Observe on UNFIXED code: `listByStepIndex` scopes correctly to the given `pathId` (no cross-path leakage)
  - Observe on UNFIXED code: `listByPathId` and `listByJobId` return all serials including scrapped ones
  - Write property-based tests with `fast-check`:
    - For all non-scrapped serials (`in_progress`) at a step, `listByStepIndex` includes them (preservation of Req 3.1)
    - For all calls to `listByPathId`, scrapped serials are still included (preservation of Req 3.5)
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 3. Fix for scrapped serials appearing in operator work queue

  - [x] 3.1 Implement the fix
    - In `server/repositories/sqlite/serialRepository.ts`, method `listByStepIndex`
    - Change the SQL query from:
      ```sql
      SELECT * FROM serials WHERE path_id = ? AND current_step_index = ? ORDER BY created_at ASC
      ```
      to:
      ```sql
      SELECT * FROM serials WHERE path_id = ? AND current_step_index = ? AND status != 'scrapped' ORDER BY created_at ASC
      ```
    - This is a single-line change — no other files need modification
    - _Bug_Condition: isBugCondition(input) where serial.pathId = pathId AND serial.currentStepIndex = stepIndex AND serial.status = 'scrapped'_
    - _Expected_Behavior: listByStepIndex returns only serials with status != 'scrapped' for the given pathId and stepIndex_
    - _Preservation: listByPathId, listByJobId, listAll, getById, countByJobId unchanged — only listByStepIndex is modified_
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Scrapped Serials Excluded from Step Query
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior (no scrapped serials in `listByStepIndex` results)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run `npx vitest run tests/properties/scrappedSnStepQuery.property.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Scrapped Serials Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run `npx vitest run` to execute the full test suite
  - Verify all 524+ existing tests still pass (no regressions from the SQL change)
  - Verify the new property tests in `scrappedSnStepQuery.property.test.ts` all pass
  - Ensure all tests pass, ask the user if questions arise.
