import type { TemplateRepository } from '../repositories/interfaces/templateRepository'
import type { PathRepository } from '../repositories/interfaces/pathRepository'
import type { TemplateRoute, TemplateStep, Path, ProcessStep, DependencyType } from '../types/domain'
import type { CreateTemplateInput, ApplyTemplateInput } from '../types/api'
import { generateId } from '../utils/idGenerator'
import { assertNonEmpty, assertNonEmptyArray } from '../utils/validation'
import { NotFoundError } from '../utils/errors'

export function createTemplateService(repos: {
  templates: TemplateRepository
  paths: PathRepository
}) {
  return {
    createTemplate(input: CreateTemplateInput): TemplateRoute {
      assertNonEmpty(input.name, 'name')
      assertNonEmptyArray(input.steps, 'steps')

      const now = new Date().toISOString()
      const steps: TemplateStep[] = input.steps.map((s, index) => ({
        name: s.name,
        order: index,
        location: s.location,
        optional: false,
        dependencyType: 'preferred' as const,
      }))

      return repos.templates.create({
        id: generateId('tmpl'),
        name: input.name.trim(),
        steps,
        createdAt: now,
        updatedAt: now,
      })
    },

    getTemplate(id: string): TemplateRoute {
      const template = repos.templates.getById(id)
      if (!template) {
        throw new NotFoundError('TemplateRoute', id)
      }
      return template
    },

    listTemplates(): TemplateRoute[] {
      return repos.templates.list()
    },

    deleteTemplate(id: string): boolean {
      return repos.templates.delete(id)
    },

    applyTemplate(templateId: string, input: ApplyTemplateInput): Path {
      const template = repos.templates.getById(templateId)
      if (!template) {
        throw new NotFoundError('TemplateRoute', templateId)
      }

      const now = new Date().toISOString()

      // Deep-clone template steps into new ProcessSteps with fresh IDs
      const steps: ProcessStep[] = template.steps.map(ts => ({
        id: generateId('step'),
        name: ts.name,
        order: ts.order,
        location: ts.location,
        optional: ts.optional ?? false,
        dependencyType: ts.dependencyType ?? 'preferred',
        completedCount: 0,
      }))

      const path: Path = {
        id: generateId('path'),
        jobId: input.jobId,
        name: input.pathName ?? template.name,
        goalQuantity: input.goalQuantity,
        steps,
        advancementMode: 'strict',
        createdAt: now,
        updatedAt: now,
      }

      return repos.paths.create(path)
    },

    updateTemplate(id: string, input: { name?: string, steps?: { name: string, location?: string, optional?: boolean, dependencyType?: DependencyType }[] }): TemplateRoute {
      const existing = repos.templates.getById(id)
      if (!existing) {
        throw new NotFoundError('TemplateRoute', id)
      }

      const partial: Partial<TemplateRoute> = { updatedAt: new Date().toISOString() }
      if (input.name !== undefined) {
        assertNonEmpty(input.name, 'name')
        partial.name = input.name.trim()
      }
      if (input.steps !== undefined) {
        assertNonEmptyArray(input.steps, 'steps')
        partial.steps = input.steps.map((s, index) => ({
          name: s.name,
          order: index,
          location: s.location,
          optional: s.optional ?? false,
          dependencyType: s.dependencyType ?? 'preferred',
        }))
      }

      return repos.templates.update(id, partial)
    },
  }
}

export type TemplateService = ReturnType<typeof createTemplateService>
