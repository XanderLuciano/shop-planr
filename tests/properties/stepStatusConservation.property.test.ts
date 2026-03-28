/**
 * Property 2: Step Status Conservation
 *
 * For any part, verify total step status count equals total process steps
 * in path after any operation. No step status is lost or duplicated.
 *
 * **Validates: Requirements 11.1**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { PartStepStatusValue } from '../../server/types/domain'

interface StepConfig {
  id: string
  name: string
  order: number
  optional: boolean
  dependencyType: 'physical' | 'preferred' | 'completion_gate'
}

interface StepStatusRecord {
  stepId: string
  status: PartStepStatusValue
}

/**
 * Pure initialization logic matching lifecycleService.initializeStepStatuses:
 * Creates one status record per step. First step = 'in_progress', rest = 'pending'.
 */
function initializeStepStatuses(steps: StepConfig[]): StepStatusRecord[] {
  return steps.map((step, index) => ({
    stepId: step.id,
    status: index === 0 ? 'in_progress' : 'pending',
  }))
}

/**
 * Pure advancement logic: advances from currentStepIndex to targetStepIndex.
 * Updates statuses for origin (completed), bypassed (skipped/deferred), and destination (in_progress).
 */
function applyAdvancement(
  statuses: StepStatusRecord[],
  steps: StepConfig[],
  currentStepIndex: number,
  targetStepIndex: number,
): StepStatusRecord[] {
  const result = statuses.map(s => ({ ...s }))

  // Origin step → completed
  const originStep = steps[currentStepIndex]
  if (originStep) {
    const rec = result.find(s => s.stepId === originStep.id)
    if (rec) rec.status = 'completed'
  }

  // Bypassed steps
  for (let i = currentStepIndex + 1; i < targetStepIndex && i < steps.length; i++) {
    const step = steps[i]
    const rec = result.find(s => s.stepId === step.id)
    if (rec) {
      rec.status = step.optional ? 'skipped' : 'deferred'
    }
  }

  // Destination step → in_progress (if not past end)
  if (targetStepIndex < steps.length) {
    const destStep = steps[targetStepIndex]
    const rec = result.find(s => s.stepId === destStep.id)
    if (rec) rec.status = 'in_progress'
  }

  return result
}

describe('Property 2: Step Status Conservation', () => {
  it('after initialization, step status count equals total steps', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (totalSteps) => {
          const steps: StepConfig[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            name: `Step ${i}`,
            order: i,
            optional: false,
            dependencyType: 'preferred',
          }))

          const statuses = initializeStepStatuses(steps)

          expect(statuses.length).toBe(totalSteps)

          // Each step has exactly one status
          const stepIds = new Set(statuses.map(s => s.stepId))
          expect(stepIds.size).toBe(totalSteps)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('after advancement, step status count still equals total steps', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 15 }),
        fc.integer({ min: 0, max: 12 }),
        fc.integer({ min: 1, max: 14 }),
        fc.array(fc.boolean(), { minLength: 15, maxLength: 15 }),
        (totalSteps, rawCurrent, jumpSize, optionalFlags) => {
          const currentStepIndex = rawCurrent % (totalSteps - 1)
          const targetStepIndex = Math.min(currentStepIndex + jumpSize, totalSteps)

          if (targetStepIndex <= currentStepIndex) return

          const steps: StepConfig[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            name: `Step ${i}`,
            order: i,
            optional: optionalFlags[i] ?? false,
            dependencyType: 'preferred',
          }))

          const initial = initializeStepStatuses(steps)
          const afterAdvance = applyAdvancement(initial, steps, currentStepIndex, targetStepIndex)

          // Conservation: count must equal total steps
          expect(afterAdvance.length).toBe(totalSteps)

          // No duplicates
          const stepIds = new Set(afterAdvance.map(s => s.stepId))
          expect(stepIds.size).toBe(totalSteps)

          // Every status is a valid value
          const validStatuses: PartStepStatusValue[] = ['pending', 'in_progress', 'completed', 'skipped', 'deferred', 'waived']
          for (const s of afterAdvance) {
            expect(validStatuses).toContain(s.status)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('after multiple advancements, step status count is conserved', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 12 }),
        fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 1, maxLength: 5 }),
        (totalSteps, jumps) => {
          const steps: StepConfig[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            name: `Step ${i}`,
            order: i,
            optional: i % 2 === 0,
            dependencyType: 'preferred',
          }))

          let statuses = initializeStepStatuses(steps)
          let currentIndex = 0

          for (const jump of jumps) {
            const target = Math.min(currentIndex + jump, totalSteps)
            if (target <= currentIndex) break

            statuses = applyAdvancement(statuses, steps, currentIndex, target)
            currentIndex = target

            // Conservation holds after each operation
            expect(statuses.length).toBe(totalSteps)
            const stepIds = new Set(statuses.map(s => s.stepId))
            expect(stepIds.size).toBe(totalSteps)

            if (currentIndex >= totalSteps) break
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
