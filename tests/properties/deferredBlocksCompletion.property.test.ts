/**
 * Property 3: Deferred Step Blocks Normal Completion
 *
 * For any part with deferred required steps, verify normal completion
 * is rejected (canComplete returns false).
 *
 * **Validates: Requirements 4.7, 11.7**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { PartStepStatusValue } from '../../server/types/domain'

interface StepConfig {
  id: string
  optional: boolean
}

interface StepStatusRecord {
  stepId: string
  status: PartStepStatusValue
}

/**
 * Pure canComplete logic matching lifecycleService.canComplete:
 * Returns true only if all required steps (not optional, not overridden)
 * have status 'completed' or 'waived'.
 */
function canComplete(
  steps: StepConfig[],
  stepStatuses: StepStatusRecord[],
  overriddenStepIds: Set<string>,
): { canComplete: boolean, blockers: string[] } {
  const blockers: string[] = []
  for (const step of steps) {
    if (step.optional) continue
    if (overriddenStepIds.has(step.id)) continue

    const status = stepStatuses.find(s => s.stepId === step.id)
    if (!status || (status.status !== 'completed' && status.status !== 'waived')) {
      blockers.push(step.id)
    }
  }
  return { canComplete: blockers.length === 0, blockers }
}

describe('Property 3: Deferred Step Blocks Normal Completion', () => {
  it('any part with at least one deferred required step cannot complete normally', () => {
    fc.assert(
      fc.property(
        // totalSteps: 2..10
        fc.integer({ min: 2, max: 10 }),
        // which step index is deferred (required)
        fc.integer({ min: 0, max: 9 }),
        (totalSteps, deferredIdx) => {
          const deferredStepIndex = deferredIdx % totalSteps

          const steps: StepConfig[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            optional: false, // all required
          }))

          // All steps completed except the deferred one
          const stepStatuses: StepStatusRecord[] = steps.map((step, i) => ({
            stepId: step.id,
            status: i === deferredStepIndex ? 'deferred' : 'completed',
          }))

          const result = canComplete(steps, stepStatuses, new Set())

          expect(result.canComplete).toBe(false)
          expect(result.blockers).toContain(`step-${deferredStepIndex}`)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('multiple deferred required steps all appear as blockers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 10 }),
        fc.integer({ min: 2, max: 5 }),
        (totalSteps, deferredCount) => {
          const actualDeferred = Math.min(deferredCount, totalSteps)

          const steps: StepConfig[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            optional: false,
          }))

          // First N steps deferred, rest completed
          const stepStatuses: StepStatusRecord[] = steps.map((step, i) => ({
            stepId: step.id,
            status: i < actualDeferred ? 'deferred' : 'completed',
          }))

          const result = canComplete(steps, stepStatuses, new Set())

          expect(result.canComplete).toBe(false)
          expect(result.blockers.length).toBe(actualDeferred)
          for (let i = 0; i < actualDeferred; i++) {
            expect(result.blockers).toContain(`step-${i}`)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('pending required steps also block completion', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 0, max: 9 }),
        (totalSteps, pendingIdx) => {
          const pendingStepIndex = pendingIdx % totalSteps

          const steps: StepConfig[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            optional: false,
          }))

          const stepStatuses: StepStatusRecord[] = steps.map((step, i) => ({
            stepId: step.id,
            status: i === pendingStepIndex ? 'pending' : 'completed',
          }))

          const result = canComplete(steps, stepStatuses, new Set())

          expect(result.canComplete).toBe(false)
          expect(result.blockers).toContain(`step-${pendingStepIndex}`)
        },
      ),
      { numRuns: 100 },
    )
  })
})
