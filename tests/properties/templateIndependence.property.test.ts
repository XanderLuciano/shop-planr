/**
 * Property 8: Template Route Independence
 *
 * Modifying a Path's steps after template application leaves the original template unchanged.
 * `template_before == template_after` for any modification to a derived Path.
 *
 * **Validates: Requirements 8.2, 8.3, 8.4**
 */
import { describe, it, afterEach } from 'vitest'
import fc from 'fast-check'
import Database from 'better-sqlite3'
import { resolve } from 'path'
import { runMigrations } from '../../server/repositories/sqlite/index'
import { SQLiteJobRepository } from '../../server/repositories/sqlite/jobRepository'
import { SQLitePathRepository } from '../../server/repositories/sqlite/pathRepository'
import { SQLiteSerialRepository } from '../../server/repositories/sqlite/serialRepository'
import { SQLiteTemplateRepository } from '../../server/repositories/sqlite/templateRepository'
import { createJobService } from '../../server/services/jobService'
import { createPathService } from '../../server/services/pathService'
import { createTemplateService } from '../../server/services/templateService'

function createTestDb() {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  const migrationsDir = resolve(__dirname, '../../server/repositories/sqlite/migrations')
  runMigrations(db, migrationsDir)
  return db
}

function setupServices(db: Database.default.Database) {
  const repos = {
    jobs: new SQLiteJobRepository(db),
    paths: new SQLitePathRepository(db),
    serials: new SQLiteSerialRepository(db),
    templates: new SQLiteTemplateRepository(db)
  }

  const jobService = createJobService({ jobs: repos.jobs, paths: repos.paths, serials: repos.serials })
  const pathService = createPathService({ paths: repos.paths, serials: repos.serials })
  const templateService = createTemplateService({ templates: repos.templates, paths: repos.paths })

  return { jobService, pathService, templateService }
}

describe('Property 8: Template Route Independence', () => {
  let db: Database.default.Database

  afterEach(() => {
    if (db) db.close()
  })

  it('modifying a derived path leaves the original template unchanged', () => {
    fc.assert(
      fc.property(
        fc.record({
          templateStepCount: fc.integer({ min: 1, max: 5 }),
          // Modification: replace all steps with a different set
          newStepCount: fc.integer({ min: 1, max: 5 })
        }),
        ({ templateStepCount, newStepCount }) => {
          db = createTestDb()
          const { jobService, pathService, templateService } = setupServices(db)

          // Create a template with random steps
          const templateSteps = Array.from({ length: templateStepCount }, (_, i) => ({
            name: `Template Step ${i}`,
            location: i % 2 === 0 ? `Location ${i}` : undefined
          }))

          const template = templateService.createTemplate({
            name: 'Test Template',
            steps: templateSteps
          })

          // Snapshot template before modification
          const templateBefore = templateService.getTemplate(template.id)
          const stepsBefore = templateBefore.steps.map(s => ({
            name: s.name,
            order: s.order,
            location: s.location
          }))

          // Apply template to a job
          const job = jobService.createJob({ name: 'Test Job', goalQuantity: 10 })
          const derivedPath = templateService.applyTemplate(template.id, {
            jobId: job.id,
            goalQuantity: 10
          })

          // Modify the derived path's steps (replace with completely different steps)
          const newSteps = Array.from({ length: newStepCount }, (_, i) => ({
            name: `Modified Step ${i}`,
            location: `New Location ${i}`
          }))
          pathService.updatePath(derivedPath.id, { steps: newSteps })

          // ASSERT: template is unchanged after path modification
          const templateAfter = templateService.getTemplate(template.id)
          const stepsAfter = templateAfter.steps.map(s => ({
            name: s.name,
            order: s.order,
            location: s.location
          }))

          expect(stepsAfter).toEqual(stepsBefore)
          expect(templateAfter.name).toBe(templateBefore.name)

          db.close()
          db = null as any
        }
      ),
      { numRuns: 100 }
    )
  })

  it('multiple paths derived from same template are independent of each other and the template', () => {
    fc.assert(
      fc.property(
        fc.record({
          templateStepCount: fc.integer({ min: 1, max: 4 }),
          pathCount: fc.integer({ min: 2, max: 4 })
        }),
        ({ templateStepCount, pathCount }) => {
          db = createTestDb()
          const { jobService, pathService, templateService } = setupServices(db)

          const templateSteps = Array.from({ length: templateStepCount }, (_, i) => ({
            name: `Step ${i}`
          }))

          const template = templateService.createTemplate({
            name: 'Shared Template',
            steps: templateSteps
          })

          const templateBefore = templateService.getTemplate(template.id)
          const stepNamesBefore = templateBefore.steps.map(s => s.name)

          const job = jobService.createJob({ name: 'Multi-Path Job', goalQuantity: 50 })

          // Apply template multiple times to create multiple paths
          const derivedPaths = []
          for (let i = 0; i < pathCount; i++) {
            const p = templateService.applyTemplate(template.id, {
              jobId: job.id,
              goalQuantity: 10,
              pathName: `Path ${i}`
            })
            derivedPaths.push(p)
          }

          // Modify each derived path differently
          for (let i = 0; i < derivedPaths.length; i++) {
            pathService.updatePath(derivedPaths[i].id, {
              steps: [{ name: `Custom Step for Path ${i}` }]
            })
          }

          // ASSERT: template unchanged
          const templateAfter = templateService.getTemplate(template.id)
          const stepNamesAfter = templateAfter.steps.map(s => s.name)
          expect(stepNamesAfter).toEqual(stepNamesBefore)

          // ASSERT: each derived path has its own independent steps
          for (let i = 0; i < derivedPaths.length; i++) {
            const p = pathService.getPath(derivedPaths[i].id)
            expect(p.steps.length).toBe(1)
            expect(p.steps[0].name).toBe(`Custom Step for Path ${i}`)
          }

          db.close()
          db = null as any
        }
      ),
      { numRuns: 100 }
    )
  })
})
