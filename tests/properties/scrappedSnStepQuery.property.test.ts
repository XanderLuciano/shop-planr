/**
 * Property 1: Bug Condition — Scrapped Serials Excluded from Step Query
 *
 * For any set of serials at a given step, after scrapping one or more,
 * `listByStepIndex` SHALL NOT include any serial with `status = 'scrapped'`.
 *
 * This test is expected to FAIL on unfixed code — failure confirms the bug exists.
 *
 * **Validates: Requirements 1.1, 2.1**
 */
import { describe, it, expect, afterEach } from 'vitest'
import fc from 'fast-check'
import { createTestContext, type TestContext } from '../integration/helpers'

describe('Property 1: Bug Condition — Scrapped Serials Excluded from Step Query', () => {
  let ctx: TestContext

  afterEach(() => {
    ctx?.cleanup()
  })

  it('listByStepIndex should not return any serial with status = scrapped', () => {
    fc.assert(
      fc.property(
        // Generate total serial count (1–5) and a non-empty subset of indices to scrap
        fc.integer({ min: 1, max: 5 }).chain(totalCount =>
          fc.tuple(
            fc.constant(totalCount),
            // Pick at least 1 index to scrap, up to all of them
            fc.shuffledSubarray(
              Array.from({ length: totalCount }, (_, i) => i),
              { minLength: 1 }
            )
          )
        ),
        ([totalCount, scrapIndices]) => {
          // Fresh isolated DB per run
          ctx = createTestContext()
          const { jobService, pathService, serialService, lifecycleService, repos } = ctx

          // Create job + path with one step
          const job = jobService.createJob({ name: 'Test Job', goalQuantity: totalCount })
          const path = pathService.createPath({
            jobId: job.id,
            name: 'Path',
            goalQuantity: totalCount,
            steps: [{ name: 'Step 1', order: 0 }],
          })

          // Create serials (all start at step 0, status in_progress)
          const serials = serialService.batchCreateSerials(
            { jobId: job.id, pathId: path.id, quantity: totalCount },
            'test-user'
          )

          // Scrap the selected serials
          for (const idx of scrapIndices) {
            lifecycleService.scrapSerial(serials[idx].id, {
              reason: 'defective',
              userId: 'test-user',
            })
          }

          // Query serials at step 0
          const result = repos.serials.listByStepIndex(path.id, 0)

          // Assert: no returned serial should have status = 'scrapped'
          for (const serial of result) {
            expect(serial.status).not.toBe('scrapped')
          }
        }
      ),
      { numRuns: 50 }
    )
  })
})


/**
 * Property 2: Preservation — Non-Scrapped Serials Unchanged
 *
 * These tests capture baseline behavior that MUST be preserved after the fix.
 * They MUST PASS on the current UNFIXED code.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.5**
 */

describe('Property 2: Preservation — Non-Scrapped Serials at Step Included', () => {
  let ctx: TestContext

  afterEach(() => {
    ctx?.cleanup()
  })

  it('listByStepIndex includes all in_progress serials at the queried step', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        (totalCount) => {
          ctx = createTestContext()
          const { jobService, pathService, serialService, repos } = ctx

          const job = jobService.createJob({ name: 'Test Job', goalQuantity: totalCount })
          const path = pathService.createPath({
            jobId: job.id,
            name: 'Path',
            goalQuantity: totalCount,
            steps: [{ name: 'Step 1', order: 0 }],
          })

          const serials = serialService.batchCreateSerials(
            { jobId: job.id, pathId: path.id, quantity: totalCount },
            'test-user',
          )

          // No scrapping — all serials are in_progress at step 0
          const result = repos.serials.listByStepIndex(path.id, 0)

          // Every created serial must appear in the result
          const resultIds = new Set(result.map(s => s.id))
          for (const serial of serials) {
            expect(resultIds.has(serial.id)).toBe(true)
          }
          expect(result.length).toBe(totalCount)
        },
      ),
      { numRuns: 50 },
    )
  })
})

describe('Property 2: Preservation — listByPathId Includes Scrapped Serials', () => {
  let ctx: TestContext

  afterEach(() => {
    ctx?.cleanup()
  })

  it('listByPathId returns all serials regardless of status including scrapped', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }).chain(totalCount =>
          fc.tuple(
            fc.constant(totalCount),
            fc.shuffledSubarray(
              Array.from({ length: totalCount }, (_, i) => i),
              { minLength: 1, maxLength: totalCount - 1 },
            ),
          ),
        ),
        ([totalCount, scrapIndices]) => {
          ctx = createTestContext()
          const { jobService, pathService, serialService, lifecycleService, repos } = ctx

          const job = jobService.createJob({ name: 'Test Job', goalQuantity: totalCount })
          const path = pathService.createPath({
            jobId: job.id,
            name: 'Path',
            goalQuantity: totalCount,
            steps: [{ name: 'Step 1', order: 0 }],
          })

          const serials = serialService.batchCreateSerials(
            { jobId: job.id, pathId: path.id, quantity: totalCount },
            'test-user',
          )

          // Scrap selected serials
          for (const idx of scrapIndices) {
            lifecycleService.scrapSerial(serials[idx].id, {
              reason: 'defective',
              userId: 'test-user',
            })
          }

          const result = repos.serials.listByPathId(path.id)

          // listByPathId must return ALL serials — scrapped and non-scrapped
          const resultIds = new Set(result.map(s => s.id))
          for (const serial of serials) {
            expect(resultIds.has(serial.id)).toBe(true)
          }
          expect(result.length).toBe(totalCount)

          // Verify scrapped serials are actually present with scrapped status
          const scrappedResults = result.filter(s => s.status === 'scrapped')
          expect(scrappedResults.length).toBe(scrapIndices.length)
        },
      ),
      { numRuns: 50 },
    )
  })
})

describe('Property 2: Preservation — listByStepIndex Scopes to pathId (No Cross-Path Leakage)', () => {
  let ctx: TestContext

  afterEach(() => {
    ctx?.cleanup()
  })

  it('listByStepIndex returns only serials belonging to the queried pathId', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 1, max: 3 }),
        (countA, countB) => {
          ctx = createTestContext()
          const { jobService, pathService, serialService, repos } = ctx

          const job = jobService.createJob({ name: 'Test Job', goalQuantity: countA + countB })

          const pathA = pathService.createPath({
            jobId: job.id,
            name: 'Path A',
            goalQuantity: countA,
            steps: [{ name: 'Step 1', order: 0 }],
          })
          const pathB = pathService.createPath({
            jobId: job.id,
            name: 'Path B',
            goalQuantity: countB,
            steps: [{ name: 'Step 1', order: 0 }],
          })

          const serialsA = serialService.batchCreateSerials(
            { jobId: job.id, pathId: pathA.id, quantity: countA },
            'test-user',
          )
          const serialsB = serialService.batchCreateSerials(
            { jobId: job.id, pathId: pathB.id, quantity: countB },
            'test-user',
          )

          // Query step 0 for path A — should only contain path A serials
          const resultA = repos.serials.listByStepIndex(pathA.id, 0)
          const resultAIds = new Set(resultA.map(s => s.id))
          const serialAIds = new Set(serialsA.map(s => s.id))
          const serialBIds = new Set(serialsB.map(s => s.id))

          // All path A serials present
          for (const id of serialAIds) {
            expect(resultAIds.has(id)).toBe(true)
          }
          // No path B serials leaked in
          for (const id of serialBIds) {
            expect(resultAIds.has(id)).toBe(false)
          }
          expect(resultA.length).toBe(countA)

          // Query step 0 for path B — should only contain path B serials
          const resultB = repos.serials.listByStepIndex(pathB.id, 0)
          const resultBIds = new Set(resultB.map(s => s.id))

          for (const id of serialBIds) {
            expect(resultBIds.has(id)).toBe(true)
          }
          for (const id of serialAIds) {
            expect(resultBIds.has(id)).toBe(false)
          }
          expect(resultB.length).toBe(countB)
        },
      ),
      { numRuns: 50 },
    )
  })
})
