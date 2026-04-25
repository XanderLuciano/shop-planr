/**
 * Feature: step-id-part-tracking
 * Property 17: New step behind active part shows as na
 * Property 18: N/A steps do not block completion
 *
 * P17: For any part at step S, when a new step X is inserted into the path at an
 * order before S's order, the full route for that part shall include an entry for X
 * with status 'na' and isPlanned = false. The part's currentStepId shall remain
 * unchanged, and advancing the part shall proceed to the next step after S by order,
 * not to X.
 *
 * P18: For any part that has reached the final step in its path and has one or more
 * 'na' steps in its full route, advancing the part past the final step shall mark it
 * as completed. The 'na' steps shall not prevent completion.
 *
 * **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6**
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

describe('Feature: step-id-part-tracking, Property 17: New step behind active part shows as na', () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = createReusableTestContext()
  })

  afterAll(() => {
    ctx?.cleanup()
  })

  it('inserting a step before the part\'s current position shows as na in the full route', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 6 }),
        fc.integer({ min: 1, max: 5 }),
        (stepCount, advanceSeed) => {
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

            // Advance to at least step 1 (so there's room to insert behind)
            const advanceTo = Math.max(1, advanceSeed % (stepCount - 1))
            for (let i = 0; i < advanceTo; i++) {
              const fresh = ctx.partService.getPart(part!.id)
              if (fresh.currentStepId === null) break
              advanceOneStep(ctx, part!.id)
            }

            const freshPart = ctx.partService.getPart(part!.id)
            if (freshPart.currentStepId === null) {
              // Part completed, skip this case
              return
            }

            const currentStepIdBefore = freshPart.currentStepId

            // Insert a new step at order 0 (before the part)
            const currentPath = ctx.pathService.getPath(path.id)
            const newStepInputs = [
              { name: 'Inserted Step' },
              ...currentPath.steps.map(s => ({ id: s.id, name: s.name, location: s.location })),
            ]
            const updatedPath = ctx.pathService.updatePath(path.id, { steps: newStepInputs })

            // Part's currentStepId should be unchanged
            const partAfterInsert = ctx.partService.getPart(part!.id)
            expect(partAfterInsert.currentStepId).toBe(currentStepIdBefore)

            // Build full route
            const route = buildFullRoute(ctx, part!.id)

            // The inserted step should appear as 'na'
            const insertedStep = updatedPath.steps.find(s => s.name === 'Inserted Step')!
            const naEntry = route.entries.find(e => e.stepId === insertedStep.id)
            expect(naEntry).toBeDefined()
            expect(naEntry!.status).toBe('na')
            expect(naEntry!.isPlanned).toBe(false)

            // Advancing the part should go to the next step after current by order
            const pathAfter = ctx.pathService.getPath(path.id)
            const currentStepInPath = pathAfter.steps.find(s => s.id === partAfterInsert.currentStepId)!
            const nextStepByOrder = pathAfter.steps.find(s => s.order === currentStepInPath.order + 1)

            if (nextStepByOrder) {
              advanceOneStep(ctx, part!.id)
              const advancedPart = ctx.partService.getPart(part!.id)
              expect(advancedPart.currentStepId).toBe(nextStepByOrder.id)
              // The next step should NOT be the inserted step
              expect(advancedPart.currentStepId).not.toBe(insertedStep.id)
            }
          } finally {
            rollback(ctx.db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('Feature: step-id-part-tracking, Property 18: N/A steps do not block completion', () => {
  let ctx: TestContext

  beforeAll(() => {
    ctx = createReusableTestContext()
  })

  afterAll(() => {
    ctx?.cleanup()
  })

  it('a part with N/A steps can still advance to completion', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 6 }),
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

            // Insert a new step at order 0 (behind the part)
            const currentPath = ctx.pathService.getPath(path.id)
            const newStepInputs = [
              { name: 'Inserted Behind' },
              ...currentPath.steps.map(s => ({ id: s.id, name: s.name, location: s.location })),
            ]
            ctx.pathService.updatePath(path.id, { steps: newStepInputs })

            // Advance through all remaining steps to completion
            let freshPart = ctx.partService.getPart(part!.id)
            while (freshPart.currentStepId !== null) {
              advanceOneStep(ctx, part!.id)
              freshPart = ctx.partService.getPart(part!.id)
            }

            // Part should be completed despite N/A steps
            expect(freshPart.status).toBe('completed')
            expect(freshPart.currentStepId).toBeNull()

            // Verify the full route has at least one 'na' entry
            const route = buildFullRoute(ctx, part!.id)
            const naEntries = route.entries.filter(e => e.status === 'na')
            expect(naEntries.length).toBeGreaterThanOrEqual(1)

            // Verify isCompleted
            expect(route.isCompleted).toBe(true)

            // No planned or current entries
            expect(route.entries.filter(e => e.isCurrent)).toHaveLength(0)
            expect(route.entries.filter(e => e.isPlanned)).toHaveLength(0)
          } finally {
            rollback(ctx.db)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
