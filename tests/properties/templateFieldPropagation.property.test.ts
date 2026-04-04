/**
 * Property 14: Template Field Propagation
 *
 * For any template with optional/dependencyType values, verify applying it
 * produces matching ProcessSteps and template is unchanged.
 *
 * **Validates: Requirements 4.3, 12.6**
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { createTemplateService } from '../../server/services/templateService'
import type { TemplateRoute, TemplateStep, Path, ProcessStep } from '../../server/types/domain'

/**
 * In-memory template repository for pure property testing.
 */
function createInMemoryTemplateRepo() {
  const templates = new Map<string, TemplateRoute>()
  return {
    create: (t: TemplateRoute) => {
      const stored = { ...t, steps: t.steps.map(s => ({ ...s })) }
      templates.set(t.id, stored)
      return { ...stored, steps: stored.steps.map(s => ({ ...s })) }
    },
    getById: (id: string) => {
      const t = templates.get(id)
      return t ? { ...t, steps: t.steps.map(s => ({ ...s })) } : null
    },
    list: () => [...templates.values()],
    update: (id: string, partial: Partial<TemplateRoute>) => {
      const existing = templates.get(id)!
      const updated = { ...existing, ...partial }
      templates.set(id, updated)
      return { ...updated, steps: (updated.steps || []).map(s => ({ ...s })) }
    },
    delete: () => true,
  }
}

function createInMemoryPathRepo() {
  const paths = new Map<string, Path>()
  return {
    create: (p: Path) => {
      const stored = { ...p, steps: p.steps.map(s => ({ ...s })) }
      paths.set(p.id, stored)
      return { ...stored, steps: stored.steps.map(s => ({ ...s })) }
    },
    getById: (id: string) => {
      const p = paths.get(id)
      return p ? { ...p, steps: p.steps.map(s => ({ ...s })) } : null
    },
    listByJobId: () => [],
    update: () => ({} as Path),
    delete: () => true,
    getStepById: () => null,
    updateStepAssignment: () => ({} as ProcessStep),
    updateStep: () => ({} as ProcessStep),
  }
}

const arbDependencyType = fc.constantFrom('physical' as const, 'preferred' as const, 'completion_gate' as const)

const arbNonEmptyName = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9 ]{0,18}[a-zA-Z0-9]$/)

const arbTemplateStep = fc.record({
  name: arbNonEmptyName,
  location: fc.option(arbNonEmptyName, { nil: undefined }),
  optional: fc.boolean(),
  dependencyType: arbDependencyType,
})

describe('Property 14: Template Field Propagation', () => {
  it('applying a template copies optional and dependencyType to ProcessSteps', () => {
    fc.assert(
      fc.property(
        arbNonEmptyName, // template name
        fc.array(arbTemplateStep, { minLength: 1, maxLength: 8 }), // steps
        (templateName, steps) => {
          const templateRepo = createInMemoryTemplateRepo()
          const pathRepo = createInMemoryPathRepo()
          const service = createTemplateService({ templates: templateRepo, paths: pathRepo })

          // Create template with optional/dependencyType values
          const template = service.createTemplate({
            name: templateName,
            steps: steps.map(s => ({ name: s.name, location: s.location })),
          })

          // Manually update the template steps with optional/dependencyType
          const updatedSteps: TemplateStep[] = steps.map((s, i) => ({
            name: s.name,
            order: i,
            location: s.location,
            optional: s.optional,
            dependencyType: s.dependencyType,
          }))
          templateRepo.update(template.id, { steps: updatedSteps })

          // Apply template
          const path = service.applyTemplate(template.id, {
            jobId: 'job_test',
            goalQuantity: 10,
          })

          // Verify each ProcessStep matches the TemplateStep
          expect(path.steps).toHaveLength(updatedSteps.length)
          for (let i = 0; i < updatedSteps.length; i++) {
            const ts = updatedSteps[i]!
            const ps = path.steps[i]!
            expect(ps.name).toBe(ts.name)
            expect(ps.optional).toBe(ts.optional)
            expect(ps.dependencyType).toBe(ts.dependencyType)
            expect(ps.location).toBe(ts.location)
          }

          // Verify template is unchanged after application
          const templateAfter = service.getTemplate(template.id)
          expect(templateAfter.steps).toHaveLength(updatedSteps.length)
          for (let i = 0; i < updatedSteps.length; i++) {
            expect(templateAfter.steps[i]!.optional).toBe(updatedSteps[i]!.optional)
            expect(templateAfter.steps[i]!.dependencyType).toBe(updatedSteps[i]!.dependencyType)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
