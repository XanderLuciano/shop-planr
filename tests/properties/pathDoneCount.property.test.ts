/**
 * Property Tests: Path Done Count
 *
 * CP-DONE-1: Path completed count equals parts with currentStepIndex === -1
 * CP-DONE-2: Distribution completedCount matches the formula (parts past step OR completed)
 * CP-STEP-DONE-2: Monotonic non-increasing done counts across steps
 * CP-STEP-DONE-3: Last step done count equals getPathCompletedCount
 * CP-STEP-DONE-4: Count conservation (sum partCount + pathCompleted = non-scrapped parts)
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 */
import { describe, it, afterEach, expect } from 'vitest'
import fc from 'fast-check'
import { createTestContext, type TestContext } from '../integration/helpers'

describe('Path Done Count Properties', () => {
  let ctx: TestContext

  afterEach(() => {
    ctx?.cleanup()
  })

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
          times: fc.integer({ min: 1, max: 6 })
        }),
        { minLength: 0, maxLength: 15 }
      ),
      scrapIndices: fc.array(fc.nat(), { minLength: 0, maxLength: 5 })
    })
  }

  /**
   * Helper: sets up a path scenario and returns the services + created entities.
   * Advances parts, then scraps selected ones.
   */
  function setupScenario(params: {
    stepCount: number
    partQuantity: number
    advanceOps: { partIndex: number; times: number }[]
    scrapIndices: number[]
  }) {
    // Clean up previous iteration's context to avoid leaking SQLite connections
    ctx?.cleanup()
    ctx = createTestContext()
    const { jobService, pathService, partService, lifecycleService, repos } = ctx

    const job = jobService.createJob({ name: 'Test Job', goalQuantity: 100 })
    const steps = Array.from({ length: params.stepCount }, (_, i) => ({
      name: `Step ${i}`
    }))
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: params.partQuantity,
      steps
    })

    const parts = partService.batchCreateParts(
      { jobId: job.id, pathId: path.id, quantity: params.partQuantity },
      'user_test'
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
          userId: 'user_test'
        })
        scrappedSet.add(idx)
      } catch {
        // Part may already be completed or scrapped — skip
      }
    }

    return { pathService, path, repos }
  }

  /**
   * CP-DONE-1: Path completed count equals parts with currentStepIndex === -1
   *
   * ∀ pathId: getPathCompletedCount(pathId) ===
   *   partService.listPartsByStepIndex(pathId, -1).length
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  it('CP-DONE-1: getPathCompletedCount equals count of parts with stepIndex -1', () => {
    fc.assert(
      fc.property(
        arbPathScenario(),
        (params) => {
          const { pathService, path, repos } = setupScenario(params)

          const completedCount = pathService.getPathCompletedCount(path.id)
          // listByStepIndex already excludes scrapped parts
          const partsAtMinusOne = repos.parts.listByStepIndex(path.id, -1).length

          expect(completedCount).toBe(partsAtMinusOne)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * CP-DONE-2: Distribution completedCount matches the formula
   *
   * For each step at order N, completedCount should equal the count of
   * non-scrapped parts where currentStepIndex > N OR currentStepIndex === -1.
   *
   * **Validates: Requirements 1.1, 1.2, CP-STEP-DONE-1**
   */
  it('CP-DONE-2: distribution completedCount matches formula (parts past step OR completed)', () => {
    fc.assert(
      fc.property(
        arbPathScenario(),
        (params) => {
          const { pathService, path, repos } = setupScenario(params)

          const distribution = pathService.getStepDistribution(path.id)

          // Get all non-scrapped parts for manual verification
          const allParts = repos.parts.listByPathId(path.id)
            .filter(p => p.status !== 'scrapped')

          for (const entry of distribution) {
            const expected = allParts.filter(p =>
              p.currentStepIndex === -1 || p.currentStepIndex > entry.stepOrder
            ).length

            expect(entry.completedCount).toBe(expected)
          }
        }
      ),
      { numRuns: 100 }
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
          const { pathService, path } = setupScenario(params)

          const distribution = pathService.getStepDistribution(path.id)

          for (let i = 1; i < distribution.length; i++) {
            expect(distribution[i - 1].completedCount).toBeGreaterThanOrEqual(
              distribution[i].completedCount
            )
          }
        }
      ),
      { numRuns: 100 }
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
          const { pathService, path } = setupScenario(params)

          const distribution = pathService.getStepDistribution(path.id)
          const lastEntry = distribution[distribution.length - 1]
          const pathCompleted = pathService.getPathCompletedCount(path.id)

          expect(lastEntry.completedCount).toBe(pathCompleted)
        }
      ),
      { numRuns: 100 }
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
          const { pathService, path, repos } = setupScenario(params)

          const distribution = pathService.getStepDistribution(path.id)
          const pathCompleted = pathService.getPathCompletedCount(path.id)

          const sumPartCounts = distribution.reduce((sum, d) => sum + d.partCount, 0)

          const nonScrappedTotal = repos.parts.listByPathId(path.id)
            .filter(p => p.status !== 'scrapped').length

          expect(sumPartCounts + pathCompleted).toBe(nonScrappedTotal)
        }
      ),
      { numRuns: 100 }
    )
  })
})
