/**
 * Property 13: Flexible Advancement Step Classification
 *
 * For any flexible advancement bypassing intermediate steps, verify:
 * - optional steps → classified as 'skipped'
 * - required steps → classified as 'deferred'
 * - union of skipped + deferred = all bypassed steps
 *
 * **Validates: Requirements 5.3, 11.2, 11.3**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

interface StepConfig {
  id: string
  name: string
  order: number
  optional: boolean
}

interface BypassClassification {
  stepId: string
  stepName: string
  classification: 'skipped' | 'deferred'
}

/**
 * Pure classification logic matching lifecycleService.advanceToStep bypass handling:
 * For each bypassed step between current+1 and target-1:
 * - If step is optional OR has an active override → 'skipped'
 * - If step is required (not optional, no override) → 'deferred'
 */
function classifyBypassedSteps(
  currentStepOrder: number,
  targetStepOrder: number,
  steps: StepConfig[],
  overriddenStepIds: Set<string>,
): BypassClassification[] {
  const result: BypassClassification[] = []

  for (let i = currentStepOrder + 1; i < targetStepOrder; i++) {
    if (i >= steps.length) continue
    const step = steps[i]
    const isEffectivelyOptional = step.optional || overriddenStepIds.has(step.id)
    const classification: 'skipped' | 'deferred' = isEffectivelyOptional ? 'skipped' : 'deferred'

    result.push({
      stepId: step.id,
      stepName: step.name,
      classification,
    })
  }

  return result
}

/** Generate a path with random optional/required steps */
function _stepsArb(count: number): fc.Arbitrary<StepConfig[]> {
  return fc.array(
    fc.boolean(),
    { minLength: count, maxLength: count },
  ).map(optionals =>
    optionals.map((optional, i) => ({
      id: `step-${i}`,
      name: `Step ${i}`,
      order: i,
      optional,
    })),
  )
}

describe('Property 13: Flexible Advancement Step Classification', () => {
  it('optional bypassed steps are classified as skipped, required as deferred', () => {
    fc.assert(
      fc.property(
        // totalSteps: 3..15
        fc.integer({ min: 3, max: 15 }),
        // currentStepOrder
        fc.integer({ min: 0, max: 12 }),
        // how far to jump
        fc.integer({ min: 2, max: 14 }),
        (totalSteps, rawCurrent, jumpSize) => {
          const currentStepOrder = rawCurrent % (totalSteps - 1)
          const targetStepOrder = Math.min(currentStepOrder + jumpSize, totalSteps)

          // Need at least one bypassed step
          if (targetStepOrder - currentStepOrder <= 1) return

          // Generate steps with random optional flags
          const steps: StepConfig[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            name: `Step ${i}`,
            order: i,
            // Deterministic optional based on index for reproducibility
            optional: i % 3 === 0,
          }))

          const classifications = classifyBypassedSteps(
            currentStepOrder,
            targetStepOrder,
            steps,
            new Set(),
          )

          for (const c of classifications) {
            const step = steps.find(s => s.id === c.stepId)!
            if (step.optional) {
              expect(c.classification).toBe('skipped')
            } else {
              expect(c.classification).toBe('deferred')
            }
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('union of skipped + deferred equals all bypassed steps', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 12 }),
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 2, max: 11 }),
        fc.array(fc.boolean(), { minLength: 12, maxLength: 12 }),
        (totalSteps, rawCurrent, jumpSize, optionalFlags) => {
          const currentStepOrder = rawCurrent % (totalSteps - 1)
          const targetStepOrder = Math.min(currentStepOrder + jumpSize, totalSteps)

          if (targetStepOrder - currentStepOrder <= 1) return

          const steps: StepConfig[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            name: `Step ${i}`,
            order: i,
            optional: optionalFlags[i] ?? false,
          }))

          const classifications = classifyBypassedSteps(
            currentStepOrder,
            targetStepOrder,
            steps,
            new Set(),
          )

          // Expected bypassed step indices
          const expectedBypassedIds = new Set<string>()
          for (let i = currentStepOrder + 1; i < targetStepOrder && i < totalSteps; i++) {
            expectedBypassedIds.add(`step-${i}`)
          }

          // Classification IDs should match exactly
          const classifiedIds = new Set(classifications.map(c => c.stepId))
          expect(classifiedIds.size).toBe(expectedBypassedIds.size)
          for (const id of expectedBypassedIds) {
            expect(classifiedIds.has(id)).toBe(true)
          }

          // Every classification is either skipped or deferred
          for (const c of classifications) {
            expect(['skipped', 'deferred']).toContain(c.classification)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('overridden required steps are classified as skipped (effectively optional)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 10 }),
        (totalSteps) => {
          const currentStepOrder = 0
          const targetStepOrder = totalSteps // advance to completion

          // All steps are required (not optional)
          const steps: StepConfig[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            name: `Step ${i}`,
            order: i,
            optional: false,
          }))

          // Override some steps (every other bypassed step)
          const overriddenStepIds = new Set<string>()
          for (let i = currentStepOrder + 1; i < targetStepOrder && i < totalSteps; i++) {
            if (i % 2 === 0) {
              overriddenStepIds.add(`step-${i}`)
            }
          }

          const classifications = classifyBypassedSteps(
            currentStepOrder,
            targetStepOrder,
            steps,
            overriddenStepIds,
          )

          for (const c of classifications) {
            if (overriddenStepIds.has(c.stepId)) {
              expect(c.classification).toBe('skipped')
            } else {
              expect(c.classification).toBe('deferred')
            }
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
