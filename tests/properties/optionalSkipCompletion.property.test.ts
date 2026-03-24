/**
 * Property 4: Optional Skip and Waiver Allow Completion
 *
 * For any serial where all required steps are completed/waived and only
 * optional steps are skipped, verify normal completion succeeds.
 *
 * **Validates: Requirements 4.6, 13.7**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { SnStepStatusValue } from '../../server/types/domain'

interface StepConfig {
  id: string
  optional: boolean
}

interface StepStatusRecord {
  stepId: string
  status: SnStepStatusValue
}

/**
 * Pure canComplete logic matching lifecycleService.canComplete.
 */
function canComplete(
  steps: StepConfig[],
  stepStatuses: StepStatusRecord[],
  overriddenStepIds: Set<string>,
): { canComplete: boolean; blockers: string[] } {
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

describe('Property 4: Optional Skip and Waiver Allow Completion', () => {
  it('completion succeeds when all required steps completed and only optional steps skipped', () => {
    fc.assert(
      fc.property(
        // totalSteps: 2..12
        fc.integer({ min: 2, max: 12 }),
        // array of booleans for optional flags
        fc.array(fc.boolean(), { minLength: 12, maxLength: 12 }),
        (totalSteps, optionalFlags) => {
          const steps: StepConfig[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            optional: optionalFlags[i] ?? false,
          }))

          // Required steps → completed, optional steps → skipped
          const stepStatuses: StepStatusRecord[] = steps.map(step => ({
            stepId: step.id,
            status: step.optional ? 'skipped' : 'completed',
          }))

          const result = canComplete(steps, stepStatuses, new Set())

          expect(result.canComplete).toBe(true)
          expect(result.blockers).toHaveLength(0)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('completion succeeds when required steps are waived instead of completed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        fc.array(fc.boolean(), { minLength: 10, maxLength: 10 }),
        // which required steps to waive vs complete
        fc.array(fc.boolean(), { minLength: 10, maxLength: 10 }),
        (totalSteps, optionalFlags, waiveFlags) => {
          const steps: StepConfig[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            optional: optionalFlags[i] ?? false,
          }))

          const stepStatuses: StepStatusRecord[] = steps.map((step, i) => {
            if (step.optional) return { stepId: step.id, status: 'skipped' as SnStepStatusValue }
            // Required: either completed or waived
            const status = (waiveFlags[i] ?? false) ? 'waived' : 'completed'
            return { stepId: step.id, status: status as SnStepStatusValue }
          })

          const result = canComplete(steps, stepStatuses, new Set())

          expect(result.canComplete).toBe(true)
          expect(result.blockers).toHaveLength(0)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('overridden required steps do not block completion even if not completed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 10 }),
        (totalSteps) => {
          // All steps required
          const steps: StepConfig[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            optional: false,
          }))

          // First step pending (would block), rest completed
          const stepStatuses: StepStatusRecord[] = steps.map((step, i) => ({
            stepId: step.id,
            status: i === 0 ? 'pending' : 'completed',
          }))

          // Override the first step
          const overriddenStepIds = new Set(['step-0'])

          const result = canComplete(steps, stepStatuses, overriddenStepIds)

          expect(result.canComplete).toBe(true)
          expect(result.blockers).toHaveLength(0)
        },
      ),
      { numRuns: 100 },
    )
  })
})
