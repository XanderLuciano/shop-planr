/**
 * Property 1: Bug Condition — Scrapped Parts Excluded from Step Query
 *
 * For any set of parts at a given step, after scrapping one or more,
 * `listByCurrentStepId` SHALL NOT include any part with `status = 'scrapped'`.
 *
 * This test is expected to FAIL on unfixed code — failure confirms the bug exists.
 *
 * **Validates: Requirements 1.1, 2.1**
 */
import { describe, it, expect, afterEach } from 'vitest'
import fc from 'fast-check'
import { createTestContext, type TestContext } from '../integration/helpers'

describe('Property 1: Bug Condition — Scrapped Parts Excluded from Step Query', () => {
  let ctx: TestContext

  afterEach(() => {
    ctx?.cleanup()
  })

  it('listByCurrentStepId should not return any part with status = scrapped', () => {
    fc.assert(
      fc.property(
        // Generate total part count (1–5) and a non-empty subset of indices to scrap
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
          const { jobService, pathService, partService, lifecycleService, repos } = ctx

          // Create job + path with one step
          const job = jobService.createJob({ name: 'Test Job', goalQuantity: totalCount })
          const path = pathService.createPath({
            jobId: job.id,
            name: 'Path',
            goalQuantity: totalCount,
            steps: [{ name: 'Step 1' }],
          })

          // Create parts (all start at first step, status in_progress)
          const parts = partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: totalCount },
            'test-user'
          )

          // Scrap the selected parts
          for (const idx of scrapIndices) {
            lifecycleService.scrapPart(parts[idx].id, {
              reason: 'defective',
              userId: 'test-user',
            })
          }

          // Query parts at first step by step ID
          const firstStepId = path.steps[0].id
          const result = repos.parts.listByCurrentStepId(firstStepId)

          // Assert: no returned part should have status = 'scrapped'
          for (const part of result) {
            expect(part.status).not.toBe('scrapped')
          }
        }
      ),
      { numRuns: 50 }
    )
  })
})


/**
 * Property 2: Preservation — Non-Scrapped Parts Unchanged
 *
 * These tests capture baseline behavior that MUST be preserved after the fix.
 * They MUST PASS on the current UNFIXED code.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.5**
 */

describe('Property 2: Preservation — Non-Scrapped Parts at Step Included', () => {
  let ctx: TestContext

  afterEach(() => {
    ctx?.cleanup()
  })

  it('listByCurrentStepId includes all in_progress parts at the queried step', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        (totalCount) => {
          ctx = createTestContext()
          const { jobService, pathService, partService, repos } = ctx

          const job = jobService.createJob({ name: 'Test Job', goalQuantity: totalCount })
          const path = pathService.createPath({
            jobId: job.id,
            name: 'Path',
            goalQuantity: totalCount,
            steps: [{ name: 'Step 1' }],
          })

          const parts = partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: totalCount },
            'test-user',
          )

          // No scrapping — all parts are in_progress at first step
          const firstStepId = path.steps[0].id
          const result = repos.parts.listByCurrentStepId(firstStepId)

          // Every created part must appear in the result
          const resultIds = new Set(result.map(s => s.id))
          for (const part of parts) {
            expect(resultIds.has(part.id)).toBe(true)
          }
          expect(result.length).toBe(totalCount)
        },
      ),
      { numRuns: 50 },
    )
  })
})

describe('Property 2: Preservation — listByPathId Includes Scrapped Parts', () => {
  let ctx: TestContext

  afterEach(() => {
    ctx?.cleanup()
  })

  it('listByPathId returns all parts regardless of status including scrapped', () => {
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
          const { jobService, pathService, partService, lifecycleService, repos } = ctx

          const job = jobService.createJob({ name: 'Test Job', goalQuantity: totalCount })
          const path = pathService.createPath({
            jobId: job.id,
            name: 'Path',
            goalQuantity: totalCount,
            steps: [{ name: 'Step 1' }],
          })

          const parts = partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: totalCount },
            'test-user',
          )

          // Scrap selected parts
          for (const idx of scrapIndices) {
            lifecycleService.scrapPart(parts[idx].id, {
              reason: 'defective',
              userId: 'test-user',
            })
          }

          const result = repos.parts.listByPathId(path.id)

          // listByPathId must return ALL parts — scrapped and non-scrapped
          const resultIds = new Set(result.map(s => s.id))
          for (const part of parts) {
            expect(resultIds.has(part.id)).toBe(true)
          }
          expect(result.length).toBe(totalCount)

          // Verify scrapped parts are actually present with scrapped status
          const scrappedResults = result.filter(s => s.status === 'scrapped')
          expect(scrappedResults.length).toBe(scrapIndices.length)
        },
      ),
      { numRuns: 50 },
    )
  })
})

describe('Property 2: Preservation — listByCurrentStepId Scopes to stepId (No Cross-Path Leakage)', () => {
  let ctx: TestContext

  afterEach(() => {
    ctx?.cleanup()
  })

  it('listByCurrentStepId returns only parts at the queried step', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 1, max: 3 }),
        (countA, countB) => {
          ctx = createTestContext()
          const { jobService, pathService, partService, repos } = ctx

          const job = jobService.createJob({ name: 'Test Job', goalQuantity: countA + countB })

          const pathA = pathService.createPath({
            jobId: job.id,
            name: 'Path A',
            goalQuantity: countA,
            steps: [{ name: 'Step 1' }],
          })
          const pathB = pathService.createPath({
            jobId: job.id,
            name: 'Path B',
            goalQuantity: countB,
            steps: [{ name: 'Step 1' }],
          })

          const partsA = partService.batchCreateParts(
            { jobId: job.id, pathId: pathA.id, quantity: countA },
            'test-user',
          )
          const partsB = partService.batchCreateParts(
            { jobId: job.id, pathId: pathB.id, quantity: countB },
            'test-user',
          )

          // Query first step of path A — should only contain path A parts
          const stepAId = pathA.steps[0].id
          const resultA = repos.parts.listByCurrentStepId(stepAId)
          const resultAIds = new Set(resultA.map(s => s.id))
          const partAIds = new Set(partsA.map(s => s.id))
          const partBIds = new Set(partsB.map(s => s.id))

          // All path A parts present
          for (const id of partAIds) {
            expect(resultAIds.has(id)).toBe(true)
          }
          // No path B parts leaked in
          for (const id of partBIds) {
            expect(resultAIds.has(id)).toBe(false)
          }
          expect(resultA.length).toBe(countA)

          // Query first step of path B — should only contain path B parts
          const stepBId = pathB.steps[0].id
          const resultB = repos.parts.listByCurrentStepId(stepBId)
          const resultBIds = new Set(resultB.map(s => s.id))

          for (const id of partBIds) {
            expect(resultBIds.has(id)).toBe(true)
          }
          for (const id of partAIds) {
            expect(resultBIds.has(id)).toBe(false)
          }
          expect(resultB.length).toBe(countB)
        },
      ),
      { numRuns: 50 },
    )
  })
})
