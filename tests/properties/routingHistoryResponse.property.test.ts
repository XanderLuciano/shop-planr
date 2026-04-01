/**
 * Feature: step-id-part-tracking
 * Property 15: Full route contains history, current, and planned sections
 * Property 16: Completed part full route has no planned entries
 *
 * P15: For any in-progress part, the full route response shall contain:
 * (a) historical entries ordered by sequenceNumber ascending for all steps the part
 * has passed through, (b) exactly one entry with isCurrent = true and status
 * 'in_progress', and (c) planned entries with isPlanned = true and status 'pending'
 * for each path step whose order is greater than the current step's order. The sum
 * of historical + current + planned entries shall cover every step in the path at
 * least once.
 *
 * P16: For any completed part (currentStepId = null), the full route response shall
 * contain only historical entries (no entry with isCurrent = true or isPlanned = true),
 * and isCompleted shall be true.
 *
 * **Validates: Requirements 11.1, 11.4, 11.5, 11.6, 11.8, 12.1, 12.7**
 */
import { describe, it, expect, afterEach } from 'vitest'
import fc from 'fast-check'
import { createTestContext, type TestContext } from '../integration/helpers'
import type { FullRouteEntry, FullRouteResponse } from '../../server/types/computed'
import type { PartStepStatus, ProcessStep } from '../../server/types/domain'

/**
 * Advance a part one step forward using lifecycleService.advanceToStep,
 * which properly creates routing history entries.
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
 * Build a full route response using the same logic as the API endpoint,
 * but driven directly from services and repos (no HTTP).
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

describe('Feature: step-id-part-tracking, Property 15: Full route contains history, current, and planned sections', () => {
  let ctx: TestContext

  afterEach(() => {
    if (ctx) ctx.cleanup()
  })

  it('in-progress part full route has historical, one current, and planned entries covering all steps', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 8 }),
        fc.integer({ min: 1, max: 6 }),
        (stepCount, advanceSeed) => {
          ctx = createTestContext()

          const job = ctx.jobService.createJob({ name: 'Job', goalQuantity: 10 })
          const steps = Array.from({ length: stepCount }, (_, i) => ({ name: `Step ${i}` }))
          const path = ctx.pathService.createPath({
            jobId: job.id, name: 'Path', goalQuantity: 10, steps,
          })

          const [part] = ctx.partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: 1 }, 'user1',
          )

          // Advance to a non-final step (keep part in-progress)
          const advanceTo = advanceSeed % (stepCount - 1) // 0..stepCount-2
          for (let i = 0; i < advanceTo; i++) {
            advanceOneStep(ctx, part!.id)
          }

          // Part should still be in-progress
          const freshPart = ctx.partService.getPart(part!.id)
          expect(freshPart.currentStepId).not.toBeNull()

          const route = buildFullRoute(ctx, part!.id)

          // (a) Not completed
          expect(route.isCompleted).toBe(false)

          // (b) Exactly one isCurrent entry with status 'in_progress'
          const currentEntries = route.entries.filter(e => e.isCurrent)
          expect(currentEntries).toHaveLength(1)
          expect(currentEntries[0]!.status).toBe('in_progress')

          // (c) Historical entries (sequenceNumber defined, not current)
          //     should have sequenceNumbers in ascending order
          const historical = route.entries.filter(e => e.sequenceNumber !== undefined && !e.isCurrent)
          for (let i = 1; i < historical.length; i++) {
            expect(historical[i]!.sequenceNumber!).toBeGreaterThanOrEqual(historical[i - 1]!.sequenceNumber!)
          }

          // (d) Planned entries have isPlanned = true and status 'pending'
          const planned = route.entries.filter(e => e.isPlanned)
          for (const p of planned) {
            expect(p.status).toBe('pending')
            expect(p.isCurrent).toBe(false)
          }

          // (e) Every active step in the path is covered at least once
          const coveredStepIds = new Set(route.entries.map(e => e.stepId))
          for (const step of path.steps) {
            expect(coveredStepIds.has(step.id)).toBe(true)
          }

          ctx.cleanup()
          ctx = null as any
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('Feature: step-id-part-tracking, Property 16: Completed part full route has no planned entries', () => {
  let ctx: TestContext

  afterEach(() => {
    if (ctx) ctx.cleanup()
  })

  it('completed part full route has only historical entries, no isCurrent or isPlanned', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        (stepCount) => {
          ctx = createTestContext()

          const job = ctx.jobService.createJob({ name: 'Job', goalQuantity: 10 })
          const steps = Array.from({ length: stepCount }, (_, i) => ({ name: `Step ${i}` }))
          const path = ctx.pathService.createPath({
            jobId: job.id, name: 'Path', goalQuantity: 10, steps,
          })

          const [part] = ctx.partService.batchCreateParts(
            { jobId: job.id, pathId: path.id, quantity: 1 }, 'user1',
          )

          // Advance through all steps to completion
          for (let i = 0; i < stepCount; i++) {
            const fresh = ctx.partService.getPart(part!.id)
            if (fresh.currentStepId === null) break
            advanceOneStep(ctx, part!.id)
          }

          // Part should be completed
          const freshPart = ctx.partService.getPart(part!.id)
          expect(freshPart.currentStepId).toBeNull()
          expect(freshPart.status).toBe('completed')

          const route = buildFullRoute(ctx, part!.id)

          // isCompleted should be true
          expect(route.isCompleted).toBe(true)

          // No isCurrent entries
          expect(route.entries.filter(e => e.isCurrent)).toHaveLength(0)

          // No isPlanned entries
          expect(route.entries.filter(e => e.isPlanned)).toHaveLength(0)

          // All entries should not be current or planned
          for (const entry of route.entries) {
            expect(entry.isCurrent).toBe(false)
            expect(entry.isPlanned).toBe(false)
          }

          ctx.cleanup()
          ctx = null as any
        },
      ),
      { numRuns: 100 },
    )
  })
})
