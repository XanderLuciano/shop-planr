/**
 * First-Step Visibility Property Tests
 *
 * Tests the `shouldIncludeStep` and `findFirstActiveStep` helper functions
 * with property-based inputs to validate first-step inclusion logic.
 *
 * Properties:
 * - CP-WQ-FS1: First-Step Visibility
 * - CP-WQ-FS2: First-Step Disappearance
 * - CP-WQ-FS3: Backward Compatibility
 * - CP-WQ-FS6: Soft-Delete Respect
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { findFirstActiveStep, shouldIncludeStep } from '~/server/utils/workQueueHelpers'
import type { ProcessStep } from '~/server/types/domain'

/** Minimal ProcessStep factory. */
function makeStep(overrides: Partial<ProcessStep> & { order: number }): ProcessStep {
  return {
    id: `step-${overrides.order}`,
    name: `Step ${overrides.order}`,
    order: overrides.order,
    optional: false,
    dependencyType: 'physical',
    completedCount: 0,
    ...overrides,
  }
}

/** Arbitrary for a single active (non-soft-deleted) ProcessStep. */
function activeStepArb(order: number): fc.Arbitrary<ProcessStep> {
  return fc.record({
    completedCount: fc.integer({ min: 0, max: 200 }),
  }).map(({ completedCount }) =>
    makeStep({ order, completedCount, id: `step-${order}` }),
  )
}

/** Arbitrary for a soft-deleted ProcessStep. */
function softDeletedStepArb(order: number): fc.Arbitrary<ProcessStep> {
  return fc.record({
    completedCount: fc.integer({ min: 0, max: 200 }),
  }).map(({ completedCount }) =>
    makeStep({
      order,
      completedCount,
      id: `step-${order}`,
      removedAt: '2024-01-01T00:00:00Z',
    }),
  )
}

/**
 * Arbitrary for a path's steps array (1–6 steps, each either active or soft-deleted).
 * Returns { steps, goalQuantity }.
 */
const pathArb = fc.integer({ min: 1, max: 6 }).chain(stepCount =>
  fc.tuple(
    fc.tuple(
      ...Array.from({ length: stepCount }, (_, i) =>
        fc.boolean().chain(isSoftDeleted =>
          isSoftDeleted ? softDeletedStepArb(i) : activeStepArb(i),
        ),
      ),
    ),
    fc.integer({ min: 1, max: 100 }),
  ).map(([stepsArr, goalQuantity]) => ({
    steps: stepsArr as ProcessStep[],
    goalQuantity,
  })),
)

describe('Property 1: First-Step Visibility (CP-WQ-FS1)', () => {
  /**
   * **Validates: Requirements 1.1, 2.1**
   *
   * For all paths where the first active step has completedCount < goalQuantity,
   * that step MUST be included (shouldIncludeStep returns true) even when partCount === 0.
   */
  it('first active step with completedCount < goalQuantity is always included even with 0 parts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }).chain(stepCount =>
          fc.tuple(
            fc.tuple(
              ...Array.from({ length: stepCount }, (_, i) => activeStepArb(i)),
            ),
            fc.integer({ min: 1, max: 100 }),
          ).map(([stepsArr, goalQuantity]) => ({
            steps: stepsArr as ProcessStep[],
            goalQuantity,
          })),
        ),
        ({ steps, goalQuantity }) => {
          const firstActive = findFirstActiveStep(steps)
          expect(firstActive).toBeDefined()

          // Ensure completedCount < goalQuantity for the first active step
          const step = { ...firstActive!, completedCount: goalQuantity - 1 }

          const result = shouldIncludeStep(step, 0, true, goalQuantity)
          expect(result).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('first active step with completedCount = 0 is always included with 0 parts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (goalQuantity) => {
          const step = makeStep({ order: 0, completedCount: 0 })
          const result = shouldIncludeStep(step, 0, true, goalQuantity)
          expect(result).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('first active step with random completedCount below goalQuantity is always included', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }).chain(goalQuantity =>
          fc.tuple(
            fc.constant(goalQuantity),
            fc.integer({ min: 0, max: goalQuantity - 1 }),
          ),
        ),
        ([goalQuantity, completedCount]) => {
          const step = makeStep({ order: 0, completedCount })
          const result = shouldIncludeStep(step, 0, true, goalQuantity)
          expect(result).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('Property 2: First-Step Disappearance (CP-WQ-FS2)', () => {
  /**
   * **Validates: Requirements 1.2**
   *
   * When the first active step has completedCount >= goalQuantity and partCount = 0,
   * the step MUST NOT appear (shouldIncludeStep returns false).
   */
  it('first active step with completedCount >= goalQuantity and 0 parts is excluded', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }).chain(goalQuantity =>
          fc.tuple(
            fc.constant(goalQuantity),
            fc.integer({ min: goalQuantity, max: goalQuantity + 50 }),
          ),
        ),
        ([goalQuantity, completedCount]) => {
          const step = makeStep({ order: 0, completedCount })
          const result = shouldIncludeStep(step, 0, true, goalQuantity)
          expect(result).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('first active step with completedCount exactly at goalQuantity and 0 parts is excluded', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }),
        (goalQuantity) => {
          const step = makeStep({ order: 0, completedCount: goalQuantity })
          const result = shouldIncludeStep(step, 0, true, goalQuantity)
          expect(result).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('Property 3: Backward Compatibility (CP-WQ-FS3)', () => {
  /**
   * **Validates: Requirements 1.3**
   *
   * Non-first-active steps with 0 parts MUST never appear in the queue
   * (shouldIncludeStep returns false).
   */
  it('non-first-active steps with 0 parts are never included', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 1, max: 100 }),
        (completedCount, goalQuantity) => {
          const step = makeStep({ order: 3, completedCount })
          const result = shouldIncludeStep(step, 0, false, goalQuantity)
          expect(result).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('non-first-active steps with parts > 0 are always included', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 50 }),
        (completedCount, goalQuantity, partCount) => {
          const step = makeStep({ order: 3, completedCount })
          const result = shouldIncludeStep(step, partCount, false, goalQuantity)
          expect(result).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('Property 6: Soft-Delete Respect (CP-WQ-FS6)', () => {
  /**
   * **Validates: Requirements 3.1, 3.2, 2.2**
   *
   * Soft-deleted steps never appear as the first active step,
   * and the correct non-deleted step inherits first-step treatment.
   */
  it('soft-deleted steps are never returned by findFirstActiveStep', () => {
    fc.assert(
      fc.property(pathArb, ({ steps }) => {
        const firstActive = findFirstActiveStep(steps)
        if (firstActive) {
          expect(firstActive.removedAt).toBeFalsy()
        }
      }),
      { numRuns: 100 },
    )
  })

  it('when step 0 is soft-deleted, the next non-deleted step inherits first-step treatment', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 6 }).chain(stepCount =>
          fc.tuple(
            fc.tuple(
              softDeletedStepArb(0),
              ...Array.from({ length: stepCount - 1 }, (_, i) => activeStepArb(i + 1)),
            ),
            fc.integer({ min: 1, max: 100 }),
          ).map(([stepsArr, goalQuantity]) => ({
            steps: stepsArr as ProcessStep[],
            goalQuantity,
          })),
        ),
        ({ steps, goalQuantity }) => {
          const firstActive = findFirstActiveStep(steps)
          expect(firstActive).toBeDefined()
          expect(firstActive!.order).toBeGreaterThan(0)
          expect(firstActive!.removedAt).toBeFalsy()

          // The inherited first-active step with completedCount below goal should be included
          const step = { ...firstActive!, completedCount: 0 }
          expect(shouldIncludeStep(step, 0, true, goalQuantity)).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('findFirstActiveStep returns the lowest-order non-deleted step', () => {
    fc.assert(
      fc.property(pathArb, ({ steps }) => {
        const firstActive = findFirstActiveStep(steps)
        if (!firstActive) {
          // All steps are soft-deleted
          expect(steps.every(s => !!s.removedAt)).toBe(true)
          return
        }

        // No non-deleted step has a lower order
        for (const s of steps) {
          if (!s.removedAt && s.order < firstActive.order) {
            expect.fail(`Step ${s.order} is active but has lower order than firstActive ${firstActive.order}`)
          }
        }
      }),
      { numRuns: 100 },
    )
  })

  it('all steps soft-deleted means no first active step and no entries', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }).chain(stepCount =>
          fc.tuple(
            ...Array.from({ length: stepCount }, (_, i) => softDeletedStepArb(i)),
          ),
        ),
        (stepsArr) => {
          const steps = stepsArr as ProcessStep[]
          const firstActive = findFirstActiveStep(steps)
          expect(firstActive).toBeUndefined()
        },
      ),
      { numRuns: 100 },
    )
  })
})
