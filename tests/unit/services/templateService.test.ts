import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTemplateService } from '../../../server/services/templateService'
import { NotFoundError, ValidationError } from '../../../server/utils/errors'
import type { TemplateRepository } from '../../../server/repositories/interfaces/templateRepository'
import type { PathRepository } from '../../../server/repositories/interfaces/pathRepository'
import type { TemplateRoute, Path } from '../../../server/types/domain'

function createMockTemplateRepo(): TemplateRepository {
  const store = new Map<string, TemplateRoute>()
  return {
    create: vi.fn((t: TemplateRoute) => { store.set(t.id, t); return t }),
    getById: vi.fn((id: string) => store.get(id) ?? null),
    list: vi.fn(() => [...store.values()]),
    update: vi.fn((id: string, partial: Partial<TemplateRoute>) => {
      const existing = store.get(id)!
      const updated = { ...existing, ...partial }
      store.set(id, updated)
      return updated
    }),
    delete: vi.fn((id: string) => store.delete(id))
  }
}

function createMockPathRepo(): PathRepository {
  const store = new Map<string, Path>()
  return {
    create: vi.fn((p: Path) => { store.set(p.id, p); return p }),
    getById: vi.fn((id: string) => store.get(id) ?? null),
    listByJobId: vi.fn((jobId: string) => [...store.values()].filter(p => p.jobId === jobId)),
    update: vi.fn((id: string, partial: Partial<Path>) => {
      const existing = store.get(id)!
      const updated = { ...existing, ...partial }
      store.set(id, updated)
      return updated
    }),
    delete: vi.fn((id: string) => store.delete(id))
  }
}

describe('TemplateService', () => {
  let templateRepo: TemplateRepository
  let pathRepo: PathRepository
  let service: ReturnType<typeof createTemplateService>

  beforeEach(() => {
    templateRepo = createMockTemplateRepo()
    pathRepo = createMockPathRepo()
    service = createTemplateService({ templates: templateRepo, paths: pathRepo })
  })

  describe('createTemplate', () => {
    it('creates a template with generated ID, ordered steps, and timestamps', () => {
      const tmpl = service.createTemplate({
        name: 'Standard Route',
        steps: [{ name: 'Machining' }, { name: 'Inspection' }, { name: 'Coating' }]
      })
      expect(tmpl.id).toMatch(/^tmpl_/)
      expect(tmpl.name).toBe('Standard Route')
      expect(tmpl.steps).toHaveLength(3)
      expect(tmpl.steps[0].name).toBe('Machining')
      expect(tmpl.steps[0].order).toBe(0)
      expect(tmpl.steps[1].order).toBe(1)
      expect(tmpl.steps[2].order).toBe(2)
      expect(tmpl.createdAt).toBeTruthy()
      expect(tmpl.updatedAt).toBeTruthy()
    })

    it('trims whitespace from name', () => {
      const tmpl = service.createTemplate({
        name: '  Trimmed  ',
        steps: [{ name: 'S1' }]
      })
      expect(tmpl.name).toBe('Trimmed')
    })

    it('assigns optional location to steps', () => {
      const tmpl = service.createTemplate({
        name: 'Route',
        steps: [{ name: 'Coating', location: 'Vendor - Anodize Co.' }]
      })
      expect(tmpl.steps[0].location).toBe('Vendor - Anodize Co.')
    })

    it('throws ValidationError for empty name', () => {
      expect(() => service.createTemplate({
        name: '', steps: [{ name: 'S1' }]
      })).toThrow(ValidationError)
    })

    it('throws ValidationError for whitespace-only name', () => {
      expect(() => service.createTemplate({
        name: '   ', steps: [{ name: 'S1' }]
      })).toThrow(ValidationError)
    })

    it('throws ValidationError for empty steps array', () => {
      expect(() => service.createTemplate({
        name: 'Route', steps: []
      })).toThrow(ValidationError)
    })
  })

  describe('getTemplate', () => {
    it('returns existing template', () => {
      const created = service.createTemplate({
        name: 'Route', steps: [{ name: 'S1' }]
      })
      const found = service.getTemplate(created.id)
      expect(found.id).toBe(created.id)
      expect(found.name).toBe('Route')
    })

    it('throws NotFoundError for missing template', () => {
      expect(() => service.getTemplate('nonexistent')).toThrow(NotFoundError)
    })
  })

  describe('listTemplates', () => {
    it('returns all templates', () => {
      service.createTemplate({ name: 'A', steps: [{ name: 'S1' }] })
      service.createTemplate({ name: 'B', steps: [{ name: 'S1' }] })
      expect(service.listTemplates()).toHaveLength(2)
    })

    it('returns empty array when no templates exist', () => {
      expect(service.listTemplates()).toHaveLength(0)
    })
  })

  describe('deleteTemplate', () => {
    it('deletes an existing template', () => {
      const tmpl = service.createTemplate({ name: 'Route', steps: [{ name: 'S1' }] })
      const result = service.deleteTemplate(tmpl.id)
      expect(result).toBe(true)
      expect(() => service.getTemplate(tmpl.id)).toThrow(NotFoundError)
    })

    it('returns false for non-existent template', () => {
      const result = service.deleteTemplate('nonexistent')
      expect(result).toBe(false)
    })
  })

  describe('applyTemplate', () => {
    it('creates a new Path from template with deep-cloned steps', () => {
      const tmpl = service.createTemplate({
        name: 'Standard Route',
        steps: [
          { name: 'Machining', location: 'Shop Floor' },
          { name: 'Inspection' },
          { name: 'Coating', location: 'Vendor - Anodize Co.' }
        ]
      })

      const path = service.applyTemplate(tmpl.id, {
        jobId: 'job_1',
        goalQuantity: 50
      })

      expect(path.id).toMatch(/^path_/)
      expect(path.jobId).toBe('job_1')
      expect(path.name).toBe('Standard Route')
      expect(path.goalQuantity).toBe(50)
      expect(path.steps).toHaveLength(3)
      expect(path.steps[0].id).toMatch(/^step_/)
      expect(path.steps[0].name).toBe('Machining')
      expect(path.steps[0].order).toBe(0)
      expect(path.steps[0].location).toBe('Shop Floor')
      expect(path.steps[1].name).toBe('Inspection')
      expect(path.steps[1].order).toBe(1)
      expect(path.steps[1].location).toBeUndefined()
      expect(path.steps[2].name).toBe('Coating')
      expect(path.steps[2].location).toBe('Vendor - Anodize Co.')
      expect(path.createdAt).toBeTruthy()
    })

    it('uses custom pathName when provided', () => {
      const tmpl = service.createTemplate({
        name: 'Standard Route',
        steps: [{ name: 'S1' }]
      })

      const path = service.applyTemplate(tmpl.id, {
        jobId: 'job_1',
        pathName: 'Custom Path Name',
        goalQuantity: 10
      })

      expect(path.name).toBe('Custom Path Name')
    })

    it('defaults path name to template name when pathName not provided', () => {
      const tmpl = service.createTemplate({
        name: 'My Template',
        steps: [{ name: 'S1' }]
      })

      const path = service.applyTemplate(tmpl.id, {
        jobId: 'job_1',
        goalQuantity: 10
      })

      expect(path.name).toBe('My Template')
    })

    it('generates new step IDs distinct from any previous apply', () => {
      const tmpl = service.createTemplate({
        name: 'Route',
        steps: [{ name: 'S1' }, { name: 'S2' }]
      })

      const path1 = service.applyTemplate(tmpl.id, { jobId: 'job_1', goalQuantity: 10 })
      const path2 = service.applyTemplate(tmpl.id, { jobId: 'job_2', goalQuantity: 20 })

      // Path IDs should differ
      expect(path1.id).not.toBe(path2.id)
      // Step IDs should differ between the two paths
      const stepIds1 = path1.steps.map((s: { id: string }) => s.id)
      const stepIds2 = path2.steps.map((s: { id: string }) => s.id)
      for (const id of stepIds1) {
        expect(stepIds2).not.toContain(id)
      }
    })

    it('leaves original template unchanged after apply', () => {
      const tmpl = service.createTemplate({
        name: 'Original',
        steps: [{ name: 'S1', location: 'Loc1' }, { name: 'S2' }]
      })

      const templateBefore = JSON.parse(JSON.stringify(service.getTemplate(tmpl.id)))

      service.applyTemplate(tmpl.id, { jobId: 'job_1', goalQuantity: 10 })

      const templateAfter = service.getTemplate(tmpl.id)
      expect(templateAfter).toEqual(templateBefore)
    })

    it('throws NotFoundError when template does not exist', () => {
      expect(() => service.applyTemplate('nonexistent', {
        jobId: 'job_1', goalQuantity: 10
      })).toThrow(NotFoundError)
    })

    it('throws NotFoundError when template has been deleted', () => {
      const tmpl = service.createTemplate({
        name: 'Route', steps: [{ name: 'S1' }]
      })
      service.deleteTemplate(tmpl.id)

      expect(() => service.applyTemplate(tmpl.id, {
        jobId: 'job_1', goalQuantity: 10
      })).toThrow(NotFoundError)
    })
  })
})
