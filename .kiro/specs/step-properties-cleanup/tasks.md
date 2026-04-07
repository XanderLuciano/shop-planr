# Tasks: Step Properties Cleanup

## Task 1: Normalize empty location in config.patch.ts [FR-2]

- [x] In `server/api/steps/[id]/config.patch.ts`, trim `body.location` and convert empty/whitespace-only strings to `undefined` before adding to the update object
- [x] Verify `npm run lint` passes for this file

## Task 2: Fix partial save in StepPropertiesEditor [FR-1, CR-3]

- [x] Refactor `handleSave()` in `app/components/StepPropertiesEditor.vue` to handle partial failures: if one PATCH succeeds and the other fails, emit `saved` so the parent re-fetches, and show a toast indicating which field failed
- [x] Replace `catch (e: any)` with `catch (e: unknown)` and use type-safe error extraction
- [x] Update `tests/unit/components/StepPropertiesEditor.test.ts` to match new behavior
- [x] Verify `npm run lint` passes for this file

## Task 3: Fix lint error in AddNoteDialog [CR-3]

- [x] In `app/components/AddNoteDialog.vue`, replace `catch (e: any)` with `catch (e: unknown)` and use type-safe error message extraction
- [x] Verify `npm run lint` passes for this file

## Task 4: Remove dead code and orphaned files [CR-1, CR-2]

- [x] Delete the `onStepAssigned` function from `app/pages/jobs/[id].vue`
- [x] Delete `app/components/StepAssignmentDropdown.vue`
- [x] Verify `npm run lint` passes for `app/pages/jobs/[id].vue`

## Task 5: Fix pre-existing lint errors in test files

- [x] Auto-fix stylistic errors in 6 test files
- [x] Fix `max-statements-per-line` in `userAdminComputed.property.test.ts` and `userAdminJobGating.property.test.ts`
- [x] Fix unused `locationItems` variable in `StepPropertiesEditor.test.ts`

## Task 6: Codebase-wide root cause sweep

- [x] Searched all app code for sequential `$fetch` calls in single try blocks (pattern 1) — `StepPropertiesEditor` was the only instance, already fixed
- [x] Searched all server code for empty-string-to-DB normalization gaps (pattern 2) — found `location` field in `pathService.createPath()` and `reconcileSteps()` not normalizing
- [x] Added `?.trim() || undefined` normalization for `location` in `reconcileSteps` (both update and insert branches) and `createPath` in `server/services/pathService.ts`
- [x] Verified `scrapPart`, `createStepOverride`, `waiveStep` already validate required string fields via truthiness checks or `assertNonEmpty`
- [x] Searched for `catch (e: any)` across all app/server code — none remaining
- [x] Confirmed client-side callers (`useJobForm`, `PathEditor`) already normalize, but service layer now also defends against direct API calls

## Task 7: Final verification

- [x] Run `npm run lint` — zero errors
- [x] Run `npm run test` — all 1253 tests pass (208 files)
