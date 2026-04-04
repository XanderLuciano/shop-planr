/**
 * Property tests for Admin Path Delete feature.
 *
 * Uses real SQLite databases via createTestContext() for full integration-style
 * property testing with fast-check.
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { createTestContext } from '../integration/helpers'
import { generateId } from '../../server/utils/idGenerator'
import { ForbiddenError } from '../../server/utils/errors'
import { filterParts } from '../../app/composables/usePartBrowser'
import type { EnrichedPart } from '../../server/types/computed'

// Feature: admin-path-delete, Property 1: Non-admin users are rejected
// **Validates: Requirements 1.2**
describe('Property 1: Non-admin users are rejected', () => {
  it('should throw ForbiddenError for any non-admin user and leave path unchanged', () => {
    fc.assert(
      fc.property(
        fc.record({
          username: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          pathName: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          stepCount: fc.integer({ min: 1, max: 5 }),
          partQuantity: fc.integer({ min: 0, max: 5 }),
        }),
        ({ username, pathName, stepCount, partQuantity }) => {
          const ctx = createTestContext()
          try {
            // Create a non-admin user
            const user = ctx.repos.users.create({
              id: generateId('user'),
              username,
              displayName: `Test ${username}`,
              isAdmin: false,
              active: true,
              createdAt: new Date().toISOString(),
            })

            // Create a job and path
            const job = ctx.jobService.createJob({ name: 'Test Job', goalQuantity: 100 })
            const steps = Array.from({ length: stepCount }, (_, i) => ({ name: `Step ${i}` }))
            const path = ctx.pathService.createPath({
              jobId: job.id,
              name: pathName,
              goalQuantity: 10,
              steps,
            })

            // Optionally create parts
            if (partQuantity > 0) {
              ctx.partService.batchCreateParts(
                { jobId: job.id, pathId: path.id, quantity: partQuantity },
                user.id,
              )
            }

            // Attempt delete — should throw ForbiddenError
            let threw = false
            try {
              ctx.pathService.deletePath(path.id, user.id)
            } catch (err) {
              expect(err).toBeInstanceOf(ForbiddenError)
              threw = true
            }
            expect(threw).toBe(true)

            // Path should still exist
            const stillExists = ctx.repos.paths.getById(path.id)
            expect(stillExists).not.toBeNull()
            expect(stillExists!.id).toBe(path.id)
          } finally {
            ctx.cleanup()
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

// Feature: admin-path-delete, Property 2: Cascade delete completeness
// **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**
describe('Property 2: Cascade delete completeness', () => {
  it('should remove path, parts, and all dependent records for any random configuration', () => {
    fc.assert(
      fc.property(
        fc.record({
          partCount: fc.integer({ min: 1, max: 5 }),
          notesPerStep: fc.integer({ min: 0, max: 2 }),
          overridesPerPart: fc.boolean(),
          certAttachmentsPerPart: fc.boolean(),
          statusesPerPart: fc.boolean(),
        }),
        ({ partCount, notesPerStep, overridesPerPart, certAttachmentsPerPart, statusesPerPart }) => {
          const ctx = createTestContext()
          try {
            // Create admin user
            const admin = ctx.repos.users.create({
              id: generateId('user'),
              username: 'admin_cascade',
              displayName: 'Admin',
              isAdmin: true,
              active: true,
              createdAt: new Date().toISOString(),
            })

            // Create job + path with 2 steps
            const job = ctx.jobService.createJob({ name: 'Cascade Job', goalQuantity: 100 })
            const path = ctx.pathService.createPath({
              jobId: job.id,
              name: 'Cascade Path',
              goalQuantity: partCount,
              steps: [{ name: 'Step A' }, { name: 'Step B' }],
            })
            const stepIds = path.steps.map(s => s.id)

            // Create parts
            const parts = ctx.partService.batchCreateParts(
              { jobId: job.id, pathId: path.id, quantity: partCount },
              admin.id,
            )
            const partIds = parts.map(p => p.id)

            // Create dependent records for each part
            for (const part of parts) {
              // Notes per step
              for (const stepId of stepIds) {
                for (let n = 0; n < notesPerStep; n++) {
                  ctx.repos.notes.create({
                    id: generateId('note'),
                    jobId: job.id,
                    pathId: path.id,
                    stepId,
                    partIds: [part.id],
                    text: `Note ${n}`,
                    createdBy: admin.id,
                    createdAt: new Date().toISOString(),
                    pushedToJira: false,
                  })
                }
              }

              // Part step overrides
              if (overridesPerPart) {
                ctx.repos.partStepOverrides.create({
                  id: generateId('pso'),
                  partId: part.id,
                  stepId: stepIds[0]!,
                  active: true,
                  reason: 'test override',
                  createdBy: admin.id,
                  createdAt: new Date().toISOString(),
                })
              }

              // Cert attachments
              if (certAttachmentsPerPart) {
                const cert = ctx.certService.createCert({ type: 'material', name: 'Test Cert' })
                ctx.repos.certs.attachToPart({
                  partId: part.id,
                  certId: cert.id,
                  stepId: stepIds[0]!,
                  attachedAt: new Date().toISOString(),
                  attachedBy: admin.id,
                })
              }

              // Part step statuses
              if (statusesPerPart) {
                ctx.repos.partStepStatuses.create({
                  id: generateId('pss'),
                  partId: part.id,
                  stepId: stepIds[0]!,
                  sequenceNumber: 1,
                  status: 'in_progress',
                  enteredAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                })
              }
            }

            // Execute admin delete
            ctx.pathService.deletePath(path.id, admin.id)

            // Verify: path gone
            expect(ctx.repos.paths.getById(path.id)).toBeNull()

            // Verify: no parts with that pathId
            const remainingParts = ctx.db.prepare(
              'SELECT COUNT(*) as count FROM parts WHERE path_id = ?',
            ).get(path.id) as { count: number }
            expect(remainingParts.count).toBe(0)

            // Verify: no step_notes for those stepIds
            for (const stepId of stepIds) {
              const remainingNotes = ctx.db.prepare(
                'SELECT COUNT(*) as count FROM step_notes WHERE step_id = ?',
              ).get(stepId) as { count: number }
              expect(remainingNotes.count).toBe(0)
            }

            // Verify: no part_step_overrides for those partIds
            for (const partId of partIds) {
              const remainingOverrides = ctx.db.prepare(
                'SELECT COUNT(*) as count FROM part_step_overrides WHERE part_id = ?',
              ).get(partId) as { count: number }
              expect(remainingOverrides.count).toBe(0)
            }

            // Verify: no cert_attachments for those partIds
            for (const partId of partIds) {
              const remainingCerts = ctx.db.prepare(
                'SELECT COUNT(*) as count FROM cert_attachments WHERE part_id = ?',
              ).get(partId) as { count: number }
              expect(remainingCerts.count).toBe(0)
            }

            // Verify: no part_step_statuses for those partIds
            for (const partId of partIds) {
              const remainingStatuses = ctx.db.prepare(
                'SELECT COUNT(*) as count FROM part_step_statuses WHERE part_id = ?',
              ).get(partId) as { count: number }
              expect(remainingStatuses.count).toBe(0)
            }
          } finally {
            ctx.cleanup()
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

// Feature: admin-path-delete, Property 3: Audit entry completeness
// **Validates: Requirements 3.1, 3.2, 3.3**
describe('Property 3: Audit entry completeness', () => {
  it('should record audit entry with correct fields for any admin path deletion', () => {
    fc.assert(
      fc.property(
        fc.record({
          partCount: fc.integer({ min: 0, max: 5 }),
          pathName: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        }),
        ({ partCount, pathName }) => {
          const ctx = createTestContext()
          try {
            // Create admin user
            const admin = ctx.repos.users.create({
              id: generateId('user'),
              username: 'admin_audit',
              displayName: 'Audit Admin',
              isAdmin: true,
              active: true,
              createdAt: new Date().toISOString(),
            })

            // Create job + path
            const job = ctx.jobService.createJob({ name: 'Audit Job', goalQuantity: 100 })
            const path = ctx.pathService.createPath({
              jobId: job.id,
              name: pathName,
              goalQuantity: Math.max(partCount, 1),
              steps: [{ name: 'Step 1' }, { name: 'Step 2' }],
            })

            // Create parts
            let partIds: string[] = []
            if (partCount > 0) {
              const parts = ctx.partService.batchCreateParts(
                { jobId: job.id, pathId: path.id, quantity: partCount },
                admin.id,
              )
              partIds = parts.map(p => p.id)
            }

            // Execute admin delete
            ctx.pathService.deletePath(path.id, admin.id)

            // Find the path_deleted audit entry
            const allAudits = ctx.auditService.listAuditEntries({ limit: 10000 })
            const deleteAudits = allAudits.filter(a => a.action === 'path_deleted')
            expect(deleteAudits.length).toBe(1)

            const audit = deleteAudits[0]!
            // Verify fields
            expect(audit.userId).toBe(admin.id)
            expect(audit.pathId).toBe(path.id)
            expect(audit.jobId).toBe(job.id)

            const metadata = audit.metadata as {
              pathName: string
              deletedPartCount: number
              deletedPartIds: string[]
            }
            expect(metadata.pathName).toBe(pathName.trim())
            expect(metadata.deletedPartCount).toBe(partCount)
            // Compare as sets (order doesn't matter)
            expect(new Set(metadata.deletedPartIds)).toEqual(new Set(partIds))
          } finally {
            ctx.cleanup()
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

// Feature: admin-path-delete, Property 4: Scrapped status filter
// **Validates: Requirements 6.3**
describe('Property 4: Scrapped status filter', () => {
  const statusArb = fc.oneof(
    fc.constant('in-progress' as const),
    fc.constant('completed' as const),
    fc.constant('scrapped' as const),
  )

  const enrichedPartArb = (status: 'in-progress' | 'completed' | 'scrapped'): fc.Arbitrary<EnrichedPart> =>
    fc.record({
      id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
      jobId: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
      pathId: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
      jobName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
      pathName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
      currentStepId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
      currentStepName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
      assignedTo: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
      status: fc.constant(status),
      createdAt: fc.constant(new Date().toISOString()),
    })

  const partsArrayArb = fc.array(
    statusArb.chain(s => enrichedPartArb(s)),
    { minLength: 0, maxLength: 20 },
  )

  it('should return exactly the scrapped parts when filtering by scrapped status', () => {
    fc.assert(
      fc.property(partsArrayArb, (parts) => {
        const result = filterParts(parts, { status: 'scrapped' })
        const expectedScrapped = parts.filter(p => p.status === 'scrapped')

        // Same count
        expect(result.length).toBe(expectedScrapped.length)

        // Every returned part is scrapped
        for (const p of result) {
          expect(p.status).toBe('scrapped')
        }

        // Every scrapped part from input is in the result
        const resultIds = new Set(result.map(p => p.id))
        for (const p of expectedScrapped) {
          expect(resultIds.has(p.id) || result.includes(p)).toBe(true)
        }
      }),
      { numRuns: 100 },
    )
  })
})
