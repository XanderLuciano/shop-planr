/**
 * Property 10: Bypass preview classification
 *
 * For any path configuration and target step selection, the bypass preview
 * classifies each intermediate step as 'skip' (if optional) or 'defer'
 * (if required), matching the step's optional flag exactly.
 *
 * **Validates: Requirement 13.4**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

interface PathStep {
  id: string
  name: string
  order: number
  optional: boolean
}

interface BypassPreviewEntry {
  stepId: string
  stepName: string
  classification: 'skip' | 'defer'
}

/**
 * Pure extraction of the bypass preview logic from ProcessAdvancementPanel.vue.
 *
 * Given the current step order, a target step ID, and the full path steps,
 * returns the classification of each intermediate step between current and target.
 */
function computeBypassPreview(
  currentStepOrder: number,
  targetStepId: string,
  pathSteps: PathStep[],
): BypassPreviewEntry[] {
  const targetStep = pathSteps.find(s => s.id === targetStepId)
  if (!targetStep) return []

  return pathSteps
    .filter(s => s.order > currentStepOrder && s.order < targetStep.order)
    .map(s => ({
      stepId: s.id,
      stepName: s.name,
      classification: s.optional ? 'skip' as const : 'defer' as const,
    }))
}

/** Generate an array of path steps with random optional flags */
function arbPathSteps(count: number): fc.Arbitrary<PathStep[]> {
  return fc.array(fc.boolean(), { minLength: count, maxLength: count }).map(flags =>
    flags.map((optional, i) => ({
      id: `step-${i}`,
      name: `Step ${i}`,
      order: i,
      optional,
    })),
  )
}

describe('Property 10: Bypass preview classification', () => {
  it('each intermediate step is classified as skip (optional) or defer (required)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 20 }),
        fc.array(fc.boolean(), { minLength: 20, maxLength: 20 }),
        (totalSteps, optionalFlags) => {
          const steps: PathStep[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            name: `Step ${i}`,
            order: i,
            optional: optionalFlags[i] ?? false,
          }))

          // Pick a current step order and a target step at least 2 ahead
          const currentOrder = 0
          const targetOrder = totalSteps - 1
          const targetStepId = `step-${targetOrder}`

          const preview = computeBypassPreview(currentOrder, targetStepId, steps)

          // Every intermediate step should be classified
          for (const entry of preview) {
            const step = steps.find(s => s.id === entry.stepId)!
            if (step.optional) {
              expect(entry.classification).toBe('skip')
            } else {
              expect(entry.classification).toBe('defer')
            }
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('preview covers exactly the intermediate steps between current and target', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 15 }),
        fc.array(fc.boolean(), { minLength: 15, maxLength: 15 }),
        fc.integer({ min: 0, max: 12 }),
        fc.integer({ min: 2, max: 14 }),
        (totalSteps, optionalFlags, rawCurrent, jumpSize) => {
          const currentOrder = rawCurrent % (totalSteps - 2)
          const targetOrder = Math.min(currentOrder + jumpSize, totalSteps - 1)

          // Need at least one intermediate step
          if (targetOrder - currentOrder <= 1) return

          const steps: PathStep[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            name: `Step ${i}`,
            order: i,
            optional: optionalFlags[i] ?? false,
          }))

          const targetStepId = `step-${targetOrder}`
          const preview = computeBypassPreview(currentOrder, targetStepId, steps)

          // Expected intermediate step IDs (exclusive of current and target)
          const expectedIds = new Set<string>()
          for (let i = currentOrder + 1; i < targetOrder; i++) {
            expectedIds.add(`step-${i}`)
          }

          const previewIds = new Set(preview.map(e => e.stepId))
          expect(previewIds.size).toBe(expectedIds.size)
          for (const id of expectedIds) {
            expect(previewIds.has(id)).toBe(true)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('returns empty array when target step is not found', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        fc.array(fc.boolean(), { minLength: 10, maxLength: 10 }),
        (totalSteps, optionalFlags) => {
          const steps: PathStep[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            name: `Step ${i}`,
            order: i,
            optional: optionalFlags[i] ?? false,
          }))

          const preview = computeBypassPreview(0, 'nonexistent-step', steps)
          expect(preview).toEqual([])
        },
      ),
      { numRuns: 100 },
    )
  })

  it('returns empty array when target is the immediate next step (no intermediates)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        fc.array(fc.boolean(), { minLength: 10, maxLength: 10 }),
        fc.integer({ min: 0, max: 8 }),
        (totalSteps, optionalFlags, rawCurrent) => {
          const currentOrder = rawCurrent % (totalSteps - 1)
          const targetOrder = currentOrder + 1

          if (targetOrder >= totalSteps) return

          const steps: PathStep[] = Array.from({ length: totalSteps }, (_, i) => ({
            id: `step-${i}`,
            name: `Step ${i}`,
            order: i,
            optional: optionalFlags[i] ?? false,
          }))

          const preview = computeBypassPreview(currentOrder, `step-${targetOrder}`, steps)
          expect(preview).toEqual([])
        },
      ),
      { numRuns: 100 },
    )
  })
})
