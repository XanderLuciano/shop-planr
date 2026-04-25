/**
 * Feature: step-id-part-tracking
 * Property 20: Soft-deleted step preserves routing history
 * Property 21: Soft-deleted step excluded from active routing
 *
 * P20: For any step that is soft-deleted (removed from a path), all existing
 * part_step_statuses entries referencing that step shall remain intact and queryable.
 * The full route for parts that previously went through the step shall include the
 * step with isRemoved = true and its original status.
 *
 * P21: For any path with soft-deleted steps, path.steps (the active step list) shall
 * not include steps where removed_at is set. Step distribution, advancement, and
 * planned route entries shall only consider active steps.
 *
 * **Validates: Requirements 14.3, 14.4, 14.5, 14.7**
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fc from 'fast-check'
import { createReusableTestContext, savepoint, rollback, type TestContext } from './helpers'
import type { FullRouteEntry, FullRouteResponse } from '../../server/types/computed'
import type { PartStepStatus, ProcessStep } from '../../server/types/domain'

/**
 * Advance a part one step forward using lifecycleService.advanceToStep.
 */
function advanceOneStep(ctx: TestContext, partId: string): void {
  const part = ctx.partService.getPart(partId)
  if (part.currentStepId === null) return

  const path = ctx.pathService.getPath(part.pathId)
  const currentStep = path.steps.find(s => s.id === part.currentStepId)!
  const nextStep = path.steps.find(s => s.order === currentStep.order + 1)

  if (nextStep) {
    ctx.lifecycleService.advanceToStep(partId, { targetStepId: nextStep.id, userId: 'user1' })
  } else {
    ctx.lifecycleService.advanceToStep(partId, { targetStepId: '__complete__', userId: 'user1' })
  }
}

/**
 * Build a full route response using the same logic as the API endpoint.
 */
function buildFullRoute(ctx: TestContext, partId: string): FullRouteResponse {
  const part = ctx.partService.getPart(partId)
  const path = ctx.pathService.getPath(part.pathId)
  const routingEntries = ctx.lifecycleService.getStepStatuses(partId)

  const routingByStepId = new Map<string, PartStepStatus[]>()
  for (const entry of routingEntries) {
    const list = routingByStepId.get(entry.stepId) ?? []
    list.push(entry)
    routingByStepId.set(entry.stepId, list)
  }

  const activeStepMap = new Map<string, ProcessStep>()
  for (const step of path.steps) {
    activeStepMap.set(step.id, step)
  }

  const stepCache = new Map<string, ProcessStep>()
  for (const step of path.steps) {
    stepCache.set(step.id, step)
  }
  for (const entry of routingEntries) {
    if (!stepCache.has(entry.stepId)) {
      const step = ctx.repos.paths.getStepByIdIncludeRemoved(entry.stepId)
      if (step) stepCache.set(entry.stepId, step)
    }
  }

  const isCompleted = part.currentStepId === null
  const currentStep = part.currentStepId ? activeStepMap.get(part.currentStepId) : undefined
  const currentOrder = currentStep?.order

  const entries: FullRouteEntry[] = []

  for (const entry of routingEntries) {
    const step = stepCache.get(entry.stepId)
    if (!step) continue
    const isRemoved = !!step.removedAt
    const isCurrent = !isCompleted && entry.stepId === part.currentStepId
      && entry.status === 'in_progress'
      && entry === routingByStepId.get(entry.stepId)?.at(-1)

    entries.push({
      stepId: entry.stepId, stepName: step.name, stepOrder: step.order,
      location: step.location, assignedTo: step.assignedTo,
      sequenceNumber: entry.sequenceNumber, status: entry.status,
      enteredAt: entry.enteredAt, completedAt: entry.completedAt,
      isCurrent, isPlanned: false, isRemoved,
    })
  }

  for (const step of path.steps) {
    if (routingByStepId.has(step.id)) continue
    if (isCompleted) {
      entries.push({
        stepId: step.id, stepName: step.name, stepOrder: step.order,
        location: step.location, assignedTo: step.assignedTo,
        status: 'na', isCurrent: false, isPlanned: false, isRemoved: false,
      })
    } else if (currentOrder !== undefined && step.order < currentOrder) {
      entries.push({
        stepId: step.id, stepName: step.name, stepOrder: step.order,
        location: step.location, assignedTo: step.assignedTo,
        status: 'na', isCurrent: false, isPlanned: false, isRemoved: false,
      })
    } else if (currentOrder !== undefined && step.order > currentOrder) {
      entries.push({
        stepId: step.id, stepName: step.name, stepOrder: step.order,
        location: step.location, assignedTo: step.assignedTo,
        status: 'pending', isCurrent: false, isPlanned: true, isRemoved: false,
      })
    }
  }

  entries.sort((a, b) => {
    if (a.sequenceNumber !== undefined && b.sequenceNumber !== undefined) return a.sequenceNumber - b.sequenceNumber
    if (a.sequenceNumber !== undefined) return -1
    if (b.sequenceNumber !== undefined) return 1
    if (a.status === 'na' && b.isPlanned) return -1
    if (a.isPlanned && b.status === 'na') return 1
    return a.stepOrder - b.stepOrder
  })

  return { partId, isCompleted, entries }
}

describe('Feature: step-id-part-tracking, Property 20: Soft-deleted step preserves routing history', () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = createReusableTestContext()
  })
  afterAll(() => {
    ctx?.cleanup()
  })

  it('routing history entries for a soft-deleted step remain intact and show isRemoved in full route', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 7 }),
        (stepCount) => {
          savepoint(ctx.db)
          try {
            const job = ctx.jobService.createJob({ name: 'Job', goalQuantity: 10 })
            const steps = Array.from({ length: stepCount }, (_, i) => ({ name: `Step ${i}` }))
            const path = ctx.pathService.createPath({
              jobId: job.id, name: 'Path', goalQuantity: 10, steps,
            })

            const [part] = ctx.partService.batchCreateParts(
              { jobId: job.id, pathId: path.id, quantity: 1 }, 'user1',
            )

            // Advance past step 0 so it has routing history
            advanceOneStep(ctx, part!.id)

            const step0Id = path.steps[0]!.id

            // Verify routing history exists for step 0
            const historyBefore = ctx.lifecycleService.getStepStatuses(part!.id)
            const step0EntriesBefore = historyBefore.filter(e => e.stepId === step0Id)
            expect(step0EntriesBefore.length).toBeGreaterThan(0)

            // Soft-delete step 0 directly via repo
            const now = new Date().toISOString()
            ctx.repos.paths.softDeleteStep(step0Id, now)

            // Routing history entries for step 0 should still exist
            const historyAfter = ctx.lifecycleService.getStepStatuses(part!.id)
            const step0EntriesAfter = historyAfter.filter(e => e.stepId === step0Id)
            expect(step0EntriesAfter.length).toBe(step0EntriesBefore.length)

            // Each entry should have the same status as before
            for (let i = 0; i < step0EntriesBefore.length; i++) {
              expect(step0EntriesAfter[i]!.status).toBe(step0EntriesBefore[i]!.status)
              expect(step0EntriesAfter[i]!.sequenceNumber).toBe(step0EntriesBefore[i]!.sequenceNumber)
            }

            // Full route should include the removed step with isRemoved = true
            const route = buildFullRoute(ctx, part!.id)
            const removedEntries = route.entries.filter(e => e.stepId === step0Id)
            expect(removedEntries.length).toBeGreaterThan(0)
            for (const entry of removedEntries) {
              expect(entry.isRemoved).toBe(true)
            }

            // The step via getStepByIdIncludeRemoved should have removedAt set
            const removedStep = ctx.repos.paths.getStepByIdIncludeRemoved(step0Id)
            expect(removedStep).not.toBeNull()
            expect(removedStep!.removedAt).toBeDefined()
          } finally {
            rollback(ctx.db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('Feature: step-id-part-tracking, Property 21: Soft-deleted step excluded from active routing', () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = createReusableTestContext()
  })
  afterAll(() => {
    ctx?.cleanup()
  })

  it('path.steps does not include soft-deleted steps; distribution and advancement ignore them', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 7 }),
        (stepCount) => {
          savepoint(ctx.db)
          try {
            const job = ctx.jobService.createJob({ name: 'Job', goalQuantity: 10 })
            const steps = Array.from({ length: stepCount }, (_, i) => ({ name: `Step ${i}` }))
            const path = ctx.pathService.createPath({
              jobId: job.id, name: 'Path', goalQuantity: 10, steps,
            })

            const [part] = ctx.partService.batchCreateParts(
              { jobId: job.id, pathId: path.id, quantity: 1 }, 'user1',
            )

            // Advance past step 0
            advanceOneStep(ctx, part!.id)

            const step0Id = path.steps[0]!.id

            // Soft-delete step 0 directly via repo (set removed_at, null out step_order)
            // Also renumber remaining steps to be 0-based so advancement works correctly
            const now = new Date().toISOString()
            ctx.repos.paths.softDeleteStep(step0Id, now)

            // Renumber remaining active steps to be 0-based (as updatePath would do)
            const activeSteps = ctx.pathService.getPath(path.id).steps
            for (let i = 0; i < activeSteps.length; i++) {
              if (activeSteps[i]!.order !== i) {
                ctx.repos.paths.updateStep(activeSteps[i]!.id, { order: i })
              }
            }

            // path.steps should NOT include the removed step
            const pathAfter = ctx.pathService.getPath(path.id)
            const removedInActive = pathAfter.steps.find(s => s.id === step0Id)
            expect(removedInActive).toBeUndefined()

            // Active step count should be stepCount - 1
            expect(pathAfter.steps.length).toBe(stepCount - 1)

            // Step distribution should not include the removed step
            const distribution = ctx.pathService.getStepDistribution(path.id)
            const removedInDist = distribution.find(d => d.stepId === step0Id)
            expect(removedInDist).toBeUndefined()
            expect(distribution.length).toBe(stepCount - 1)

            // Advancement should work normally with remaining steps
            let freshPart = ctx.partService.getPart(part!.id)
            while (freshPart.currentStepId !== null) {
              advanceOneStep(ctx, part!.id)
              freshPart = ctx.partService.getPart(part!.id)
            }
            expect(freshPart.status).toBe('completed')

            // Full route planned entries should not reference removed step
            const route = buildFullRoute(ctx, part!.id)
            const plannedRemoved = route.entries.filter(e => e.isPlanned && e.stepId === step0Id)
            expect(plannedRemoved).toHaveLength(0)
          } finally {
            rollback(ctx.db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
