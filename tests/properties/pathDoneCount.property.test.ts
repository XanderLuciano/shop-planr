/**
 * Property Tests: Path Done Count
 *
 * CP-DONE-1: Path completed count equals parts with currentStepId === null
 * CP-DONE-2: Distribution completedCount matches the formula (parts past step OR completed)
 * CP-STEP-DONE-2: Monotonic non-increasing done counts across steps
 * CP-STEP-DONE-3: Last step done count equals getPathCompletedCount
 * CP-STEP-DONE-4: Count conservation (sum partCount + pathCompleted = non-scrapped parts)
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fc from 'fast-check'
import { createReusableTestContext, savepoint, rollback, type TestContext } from './helpers'

describe('Path Done Count Properties', () => {
  let ctx: TestContext

  beforeAll(() => { ctx = createReusableTestContext() })
  afterAll(() => { ctx?.cleanup() })

  /**
   * Arbitrary: generates a scenario with a path, parts, random advancements,
   * and optional scrapping of some parts.
   */
  function arbPathScenario() {
    return fc.record({
      stepCount: fc.integer({ min: 1, max: 5 }),
      partQuantity: fc.integer({ min: 1, max: 20 }),
      advanceOps: fc.array(
        fc.record({
          partIndex: fc.nat(),
          times: fc.integer({ min: 1, max: 6 }),
        }),
        { minLength: 0, maxLength: 15 },
      ),
      scrapIndices: fc.array(fc.nat(), { minLength: 0, maxLength: 5 }),
    })
  }

  /**
   * Helper: sets up a path scenario and returns the services + created entities.
   * Uses shared DB with savepoint/rollback for isolation.
   */
  function withScenario<T>(
    params: {
      stepCount: number
      partQuantity: number
      advanceOps: { partIndex: number, times: number }[]
      scrapIndices: number[]
    },
    fn: (ctx: TestContext, pathId: string) => T,
  ): T {
    const { jobService, pathService, partService, lifecycleService } = ctx

    const job = jobService.createJob({ name: 'Test Job', goalQuantity: 100 })
    const steps = Array.from({ length: params.stepCount }, (_, i) => ({
      name: `Step ${i}`,
    }))
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: params.partQuantity,
      steps,
    })

    const parts = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: params.partQuantity },
      'user_test',
    )

    // Advance some parts randomly
    for (const op of params.advanceOps) {
      const idx = op.partIndex % parts.length
      for (let t = 0; t < op.times; t++) {
        try {
          partService.advancePart(parts[idx].id, 'user_test')
        } catch {
          break
        }
      }
    }

    // Scrap selected parts (deduplicate indices, skip already-completed/scrapped)
    const scrappedSet = new Set<number>()
    for (const raw of params.scrapIndices) {
      const idx = raw % parts.length
      if (scrappedSet.has(idx)) continue
      try {
        lifecycleService.scrapPart(parts[idx].id, {
          reason: 'process_defect',
          userId: 'user_test',
        })
        scrappedSet.add(idx)
      } catch {
        // Part may already be completed or scrapped — skip
      }
    }

    return fn(ctx, path.id)
  }

  /**
   * CP-DONE-1: Path completed count equals parts with currentStepId === null
   *
   * ∀ pathId: getPathCompletedCount(pathId) ===
   *   parts.filter(p => p.currentStepId === null && p.status === 'completed').length
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  it('CP-DONE-1: getPathCompletedCount equals count of parts with currentStepId === null', () => {
    fc.assert(
      fc.property(
        arbPathScenario(),
        (params) => {
          savepoint(ctx.db)
          try {
            withScenario(params, (ctx, pathId) => {
              const completedCount = ctx.pathService.getPathCompletedCount(pathId)
              // Count completed parts (currentStepId === null, status === 'completed')
              const allParts = ctx.repos.parts.listByPathId(pathId)
              const partsCompleted = allParts.filter(p => p.currentStepId === null && p.status === 'completed').length
              expect(completedCount).toBe(partsCompleted)
            })
          } finally {
            rollback(ctx.db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * CP-DONE-2: Distribution completedCount matches step write-time counter
   *
   * For each step, completedCount should equal the step's completedCount field
   * (write-time counter incremented when parts advance past this step).
   *
   * **Validates: Requirements 1.1, 1.2, CP-STEP-DONE-1**
   */
  it('CP-DONE-2: distribution completedCount matches step write-time counter', () => {
    fc.assert(
      fc.property(
        arbPathScenario(),
        (params) => {
          savepoint(ctx.db)
          try {
            withScenario(params, (ctx, pathId) => {
              const distribution = ctx.pathService.getStepDistribution(pathId)
              const path = ctx.pathService.getPath(pathId)

              for (const entry of distribution) {
                // completedCount should match the step's write-time counter
                const step = path.steps.find(s => s.id === entry.stepId)!
                expect(entry.completedCount).toBe(step.completedCount)
              }
            })
          } finally {
            rollback(ctx.db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * CP-STEP-DONE-2: Monotonic non-increasing done counts across steps
   *
   * For any path with steps [s_0, s_1, ..., s_N]:
   *   completedCount(s_0) >= completedCount(s_1) >= ... >= completedCount(s_N)
   *
   * **Validates: Requirements 1.3**
   */
  it('CP-STEP-DONE-2: done counts are monotonically non-increasing across steps', () => {
    fc.assert(
      fc.property(
        arbPathScenario(),
        (params) => {
          savepoint(ctx.db)
          try {
            withScenario(params, (ctx, pathId) => {
              const distribution = ctx.pathService.getStepDistribution(pathId)
              for (let i = 1; i < distribution.length; i++) {
                expect(distribution[i - 1].completedCount).toBeGreaterThanOrEqual(
                  distribution[i].completedCount,
                )
              }
            })
          } finally {
            rollback(ctx.db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * CP-STEP-DONE-3: Last step done count equals getPathCompletedCount
   *
   * For any path with steps [s_0, ..., s_N]:
   *   getStepDistribution(path.id)[N].completedCount === getPathCompletedCount(path.id)
   *
   * **Validates: Requirements 1.4**
   */
  it('CP-STEP-DONE-3: last step completedCount equals getPathCompletedCount', () => {
    fc.assert(
      fc.property(
        arbPathScenario(),
        (params) => {
          savepoint(ctx.db)
          try {
            withScenario(params, (ctx, pathId) => {
              const distribution = ctx.pathService.getStepDistribution(pathId)
              const lastEntry = distribution[distribution.length - 1]
              const pathCompleted = ctx.pathService.getPathCompletedCount(pathId)
              expect(lastEntry.completedCount).toBe(pathCompleted)
            })
          } finally {
            rollback(ctx.db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * CP-STEP-DONE-4: Count conservation
   *
   * For any path:
   *   sum(distribution[i].partCount for all i) + getPathCompletedCount(path.id)
   *     === count(non-scrapped parts on path)
   *
   * **Validates: Requirements 1.5**
   */
  it('CP-STEP-DONE-4: sum of partCounts + pathCompleted equals total non-scrapped parts', () => {
    fc.assert(
      fc.property(
        arbPathScenario(),
        (params) => {
          savepoint(ctx.db)
          try {
            withScenario(params, (ctx, pathId) => {
              const distribution = ctx.pathService.getStepDistribution(pathId)
              const pathCompleted = ctx.pathService.getPathCompletedCount(pathId)

              const sumPartCounts = distribution.reduce((sum, d) => sum + d.partCount, 0)

              const nonScrappedTotal = ctx.repos.parts.listByPathId(pathId)
                .filter(p => p.status !== 'scrapped').length

              expect(sumPartCounts + pathCompleted).toBe(nonScrappedTotal)
            })
          } finally {
            rollback(ctx.db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
