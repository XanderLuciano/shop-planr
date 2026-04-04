/**
 * Feature: serial-to-part-id-rename, Property 5: Dual ID Prefix Compatibility
 *
 * For any part record, regardless of whether its ID uses the legacy `SN-` prefix
 * or the new `part_` prefix, the repository and service layers should successfully
 * look up, update, and perform lifecycle operations on that record without error.
 *
 * **Validates: Requirements 8.2, 8.3, 8.4**
 */
import { describe, it, expect, afterEach } from 'vitest'
import fc from 'fast-check'
import { createTestContext, type TestContext } from '../integration/helpers'

// ---- Arbitraries ----

/** Generate a numeric suffix between 1 and 99999 */
const arbIdSuffix = () => fc.integer({ min: 1, max: 99999 }).map(n => String(n).padStart(5, '0'))

/** Generate a legacy SN- prefixed ID */
const arbSnId = () => arbIdSuffix().map(s => `SN-${s}`)

/** Generate a new part_ prefixed ID */
const arbPartId = () => arbIdSuffix().map(s => `part_${s}`)

/** Generate either prefix type */
const _arbDualId = () => fc.oneof(arbSnId(), arbPartId())

const arbScrapReason = () =>
  fc.constantFrom(
    'out_of_tolerance' as const,
    'process_defect' as const,
    'damaged' as const,
    'operator_error' as const,
    'other' as const,
  )

// ---- Helpers ----

function seedJobAndPath(ctx: TestContext): { jobId: string, pathId: string } {
  const jobId = 'job_dual_compat'
  const pathId = 'path_dual_compat'
  const now = new Date().toISOString()

  ctx.db.prepare(`
    INSERT OR IGNORE INTO jobs (id, name, goal_quantity, created_at, updated_at)
    VALUES (?, 'Dual Compat Job', 100, ?, ?)
  `).run(jobId, now, now)

  ctx.db.prepare(`
    INSERT OR IGNORE INTO paths (id, job_id, name, goal_quantity, advancement_mode, created_at, updated_at)
    VALUES (?, ?, 'Dual Compat Path', 100, 'flexible', ?, ?)
  `).run(pathId, jobId, now, now)

  // Insert 3 steps so we can advance and test lifecycle operations
  const steps = [
    { id: 'step_dc_1', name: 'Step 1', order: 0, optional: false, dependencyType: 'preferred' },
    { id: 'step_dc_2', name: 'Step 2', order: 1, optional: false, dependencyType: 'preferred' },
    { id: 'step_dc_3', name: 'Step 3', order: 2, optional: false, dependencyType: 'preferred' },
  ]
  for (const step of steps) {
    ctx.db.prepare(`
      INSERT OR IGNORE INTO process_steps (id, path_id, name, step_order, location, optional, dependency_type, completed_count)
      VALUES (?, ?, ?, ?, NULL, ?, ?, 0)
    `).run(step.id, pathId, step.name, step.order, step.optional ? 1 : 0, step.dependencyType)
  }

  return { jobId, pathId }
}

function insertPartDirectly(ctx: TestContext, id: string, jobId: string, pathId: string) {
  const now = new Date().toISOString()
  ctx.db.prepare(`
    INSERT INTO parts (id, job_id, path_id, current_step_id, status, force_completed, created_at, updated_at)
    VALUES (?, ?, ?, 'step_dc_1', 'in_progress', 0, ?, ?)
  `).run(id, jobId, pathId, now, now)

  // Initialize step statuses so lifecycle operations work
  ctx.lifecycleService.initializeStepStatuses(id, pathId)
}

// ---- Tests ----

describe('Property 5: Dual ID Prefix Compatibility', () => {
  let ctx: TestContext

  afterEach(() => {
    if (ctx) ctx.cleanup()
  })

  it('getById returns the part for both SN- and part_ prefixed IDs', () => {
    fc.assert(
      fc.property(arbSnId(), arbPartId(), (snId, partId) => {
        ctx = createTestContext()
        const { jobId, pathId } = seedJobAndPath(ctx)

        insertPartDirectly(ctx, snId, jobId, pathId)
        insertPartDirectly(ctx, partId, jobId, pathId)

        const snResult = ctx.repos.parts.getById(snId)
        const partResult = ctx.repos.parts.getById(partId)

        expect(snResult).not.toBeNull()
        expect(snResult!.id).toBe(snId)
        expect(partResult).not.toBeNull()
        expect(partResult!.id).toBe(partId)

        ctx.cleanup()
        ctx = null as any
      }),
      { numRuns: 100 },
    )
  })

  it('advancePart succeeds for both SN- and part_ prefixed IDs', () => {
    fc.assert(
      fc.property(arbSnId(), arbPartId(), (snId, partId) => {
        ctx = createTestContext()
        const { jobId, pathId } = seedJobAndPath(ctx)

        insertPartDirectly(ctx, snId, jobId, pathId)
        insertPartDirectly(ctx, partId, jobId, pathId)

        // Advance both — should move from step 0 to step 1
        const advancedSn = ctx.partService.advancePart(snId, 'user_test')
        const advancedPart = ctx.partService.advancePart(partId, 'user_test')

        expect(advancedSn.currentStepId).toBe('step_dc_2')
        expect(advancedPart.currentStepId).toBe('step_dc_2')

        ctx.cleanup()
        ctx = null as any
      }),
      { numRuns: 100 },
    )
  })

  it('scrapPart succeeds for both SN- and part_ prefixed IDs', () => {
    fc.assert(
      fc.property(arbSnId(), arbPartId(), arbScrapReason(), (snId, partId, reason) => {
        ctx = createTestContext()
        const { jobId, pathId } = seedJobAndPath(ctx)

        insertPartDirectly(ctx, snId, jobId, pathId)
        insertPartDirectly(ctx, partId, jobId, pathId)

        const explanation = reason === 'other' ? 'test explanation' : undefined

        const scrappedSn = ctx.lifecycleService.scrapPart(snId, {
          userId: 'user_test',
          reason,
          explanation,
        })
        const scrappedPart = ctx.lifecycleService.scrapPart(partId, {
          userId: 'user_test',
          reason,
          explanation,
        })

        expect(scrappedSn.status).toBe('scrapped')
        expect(scrappedSn.scrapReason).toBe(reason)
        expect(scrappedPart.status).toBe('scrapped')
        expect(scrappedPart.scrapReason).toBe(reason)

        ctx.cleanup()
        ctx = null as any
      }),
      { numRuns: 100 },
    )
  })

  it('repository update works for both SN- and part_ prefixed IDs', () => {
    fc.assert(
      fc.property(arbSnId(), arbPartId(), fc.constantFrom('step_dc_1', 'step_dc_2', 'step_dc_3'), (snId, partId, newStepId) => {
        ctx = createTestContext()
        const { jobId, pathId } = seedJobAndPath(ctx)

        insertPartDirectly(ctx, snId, jobId, pathId)
        insertPartDirectly(ctx, partId, jobId, pathId)

        const now = new Date().toISOString()
        const updatedSn = ctx.repos.parts.update(snId, { currentStepId: newStepId, updatedAt: now })
        const updatedPart = ctx.repos.parts.update(partId, { currentStepId: newStepId, updatedAt: now })

        expect(updatedSn.currentStepId).toBe(newStepId)
        expect(updatedPart.currentStepId).toBe(newStepId)

        // Verify round-trip
        const fetchedSn = ctx.repos.parts.getById(snId)
        const fetchedPart = ctx.repos.parts.getById(partId)
        expect(fetchedSn!.currentStepId).toBe(newStepId)
        expect(fetchedPart!.currentStepId).toBe(newStepId)

        ctx.cleanup()
        ctx = null as any
      }),
      { numRuns: 100 },
    )
  })

  it('getPart service method works for both SN- and part_ prefixed IDs', () => {
    fc.assert(
      fc.property(arbSnId(), arbPartId(), (snId, partId) => {
        ctx = createTestContext()
        const { jobId, pathId } = seedJobAndPath(ctx)

        insertPartDirectly(ctx, snId, jobId, pathId)
        insertPartDirectly(ctx, partId, jobId, pathId)

        const snResult = ctx.partService.getPart(snId)
        const partResult = ctx.partService.getPart(partId)

        expect(snResult.id).toBe(snId)
        expect(snResult.status).toBe('in_progress')
        expect(partResult.id).toBe(partId)
        expect(partResult.status).toBe('in_progress')

        ctx.cleanup()
        ctx = null as any
      }),
      { numRuns: 100 },
    )
  })
})
