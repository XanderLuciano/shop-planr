/**
 * Property 9: Template application faithfully maps template steps
 *
 * For any TemplateRoute with N steps and any PathDraft, calling
 * applyTemplate(pathClientId, template) should replace the PathDraft's steps
 * with exactly N StepDrafts where each StepDraft's name, location, optional,
 * and dependencyType match the corresponding TemplateStep. The PathDraft's name,
 * goalQuantity, and advancementMode should remain unchanged.
 *
 * **Validates: Requirements 11.2, 11.3**
 */
import { describe, it, vi } from 'vitest'
import fc from 'fast-check'

// Stub auto-imported composables
vi.stubGlobal('useJobs', () => ({
  createJob: vi.fn(),
  updateJob: vi.fn(),
}))
vi.stubGlobal('usePaths', () => ({
  createPath: vi.fn(),
  updatePath: vi.fn(),
  deletePath: vi.fn(),
}))

import { useJobForm } from '~/app/composables/useJobForm'

const templateStepArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
  order: fc.constant(0),
  location: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  optional: fc.boolean(),
  dependencyType: fc.constantFrom(
    'physical' as const,
    'preferred' as const,
    'completion_gate' as const
  ),
})

const templateRouteArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  steps: fc
    .array(templateStepArb, { minLength: 1, maxLength: 6 })
    .map((steps) => steps.map((s, i) => ({ ...s, order: i }))),
  createdAt: fc.constant('2024-01-01T00:00:00Z'),
  updatedAt: fc.constant('2024-01-01T00:00:00Z'),
})

describe('Property 9: Template application faithfully maps template steps', () => {
  it('replaces path steps with template steps while preserving path metadata', () => {
    fc.assert(
      fc.property(
        templateRouteArb,
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 1, max: 1000 }),
        fc.constantFrom('strict' as const, 'flexible' as const, 'per_step' as const),
        (template, pathName, pathGoalQty, advMode) => {
          const { pathDrafts, addPath, applyTemplate } = useJobForm('create')
          addPath()

          const path = pathDrafts.value[0]
          path.name = pathName
          path.goalQuantity = pathGoalQty
          path.advancementMode = advMode

          applyTemplate(path._clientId, template)

          // Path should have exactly N steps matching the template
          expect(path.steps.length).toBe(template.steps.length)

          // Sort template steps by order for comparison
          const sortedTemplateSteps = [...template.steps].sort((a, b) => a.order - b.order)

          for (let i = 0; i < sortedTemplateSteps.length; i++) {
            const ts = sortedTemplateSteps[i]
            const sd = path.steps[i]

            expect(sd.name).toBe(ts.name)
            expect(sd.location).toBe(ts.location ?? '')
            expect(sd.optional).toBe(ts.optional)
            expect(sd.dependencyType).toBe(ts.dependencyType)
          }

          // Path metadata should be unchanged
          expect(path.name).toBe(pathName)
          expect(path.goalQuantity).toBe(pathGoalQty)
          expect(path.advancementMode).toBe(advMode)
        }
      ),
      { numRuns: 100 }
    )
  })
})
