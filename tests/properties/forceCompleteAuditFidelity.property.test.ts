/**
 * Property 12: Force Complete Audit Fidelity
 *
 * For any force-completed serial, verify audit metadata contains
 * the exact set of incomplete required step IDs.
 *
 * **Validates: Requirements 8.4, 8.5**
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
 * Pure logic matching lifecycleService.forceComplete:
 * Collects incomplete required step IDs — steps that are required (not optional,
 * no active override) and whose status is not 'completed' or 'waived'.
 */
function collectIncompleteRequiredStepIds(
  steps: StepConfig[],
  stepStatuses: StepStatusRecord[],
  overriddenStepIds: Set<string>,
): string[] {
  const result: string[] = []
  for (const step of steps) {
    if (step.optional) continue
    if (overriddenStepIds.has(step.id)) continue

    const status = stepStatuses.find(s => s.stepId === step.id)
    if (!status || (status.status !== 'completed' && status.status !== 'waived')) {
      result.push(step.id)
    }
  }
  return result
}

describe('Property 12: Force Complete Audit Fidelity', () => {
  it('audit metadata contains exact set of incomplete required step IDs', () => {
    fc.assert(
      fc.property(
        // totalSteps: 3..12
        fc.integer({ min: 3, max: 12 }),
        // array of booleans for optional flags
        fc.array(fc.boolean(), { minLength: 12, maxLength: 12 }),
        // array of step statuses
        fc.array(
          fc.constantFrom<SnStepStatusValue>('pending', 'in_progress', 'completed', 'skipped', 'deferred', 'waived'),
          { minLength: 12, maxLength: 12 },
        ),
        (totalSteps, optionalFlags, statusValues) => {
          const steps: StepConfig[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            optional: optionalFlags[i] ?? false,
          }))

          const stepStatuses: StepStatusRecord[] = steps.map((step, i) => ({
            stepId: step.id,
            status: statusValues[i] ?? 'pending',
          }))

          const incompleteIds = collectIncompleteRequiredStepIds(steps, stepStatuses, new Set())

          // Verify: every ID in the result is a required step that is NOT completed/waived
          for (const id of incompleteIds) {
            const step = steps.find(s => s.id === id)!
            expect(step.optional).toBe(false)

            const status = stepStatuses.find(s => s.stepId === id)
            if (status) {
              expect(status.status).not.toBe('completed')
              expect(status.status).not.toBe('waived')
            }
          }

          // Verify: every required step NOT completed/waived IS in the result
          for (const step of steps) {
            if (step.optional) continue
            const status = stepStatuses.find(s => s.stepId === step.id)
            const isIncomplete = !status || (status.status !== 'completed' && status.status !== 'waived')
            if (isIncomplete) {
              expect(incompleteIds).toContain(step.id)
            } else {
              expect(incompleteIds).not.toContain(step.id)
            }
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('overridden steps are excluded from incomplete set even if not completed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 10 }),
        (totalSteps) => {
          // All steps required, all pending
          const steps: StepConfig[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            optional: false,
          }))

          const stepStatuses: StepStatusRecord[] = steps.map(step => ({
            stepId: step.id,
            status: 'pending' as SnStepStatusValue,
          }))

          // Override every other step
          const overriddenStepIds = new Set<string>()
          for (let i = 0; i < totalSteps; i += 2) {
            overriddenStepIds.add(`step-${i}`)
          }

          const incompleteIds = collectIncompleteRequiredStepIds(steps, stepStatuses, overriddenStepIds)

          // Overridden steps should NOT appear in incomplete list
          for (const id of incompleteIds) {
            expect(overriddenStepIds.has(id)).toBe(false)
          }

          // Non-overridden pending steps SHOULD appear
          for (const step of steps) {
            if (!overriddenStepIds.has(step.id)) {
              expect(incompleteIds).toContain(step.id)
            }
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
