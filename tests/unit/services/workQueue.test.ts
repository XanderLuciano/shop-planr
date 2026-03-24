/**
 * Unit tests for the operator-view-redesign API endpoint logic.
 *
 * These tests replicate the endpoint aggregation logic as pure functions
 * (same pattern as the property tests) and verify specific edge cases.
 *
 * Requirements: 1.5, 2.6, 4.4
 */
import { describe, it, expect, afterEach } from 'vitest'
import { createTestContext, type TestContext } from '../../integration/helpers'
import { SQLiteUserRepository } from '../../../server/repositories/sqlite/userRepository'
import { createUserService } from '../../../server/services/userService'
import type { WorkQueueJob, WorkQueueResponse, OperatorGroup, WorkQueueGroupedResponse, StepViewResponse } from '../../../server/types/computed'

// ---- Pure function replications of endpoint logic ----

/**
 * Replicate GET /api/operator/queue/_all aggregation logic.
 */
function aggregateAllWork(ctx: TestContext): WorkQueueResponse {
  const { jobService, pathService, serialService } = ctx
  const jobs = jobService.listJobs()
  const groupMap = new Map<string, WorkQueueJob>()

  for (const job of jobs) {
    const paths = pathService.listPathsByJob(job.id)
    for (const path of paths) {
      const totalSteps = path.steps.length
      for (const step of path.steps) {
        const serials = serialService.listSerialsByStepIndex(path.id, step.order)
        if (serials.length === 0) continue
        const key = `${job.id}|${path.id}|${step.order}`
        const isFinalStep = step.order === totalSteps - 1
        const nextStep = isFinalStep ? undefined : path.steps[step.order + 1]
        groupMap.set(key, {
          jobId: job.id, jobName: job.name, pathId: path.id, pathName: path.name,
          stepId: step.id, stepName: step.name, stepOrder: step.order, stepLocation: step.location,
          totalSteps, serialIds: serials.map(s => s.id), partCount: serials.length,
          nextStepName: nextStep?.name, nextStepLocation: nextStep?.location, isFinalStep,
        })
      }
    }
  }

  const queueJobs = Array.from(groupMap.values())
  const totalParts = queueJobs.reduce((sum, j) => sum + j.partCount, 0)
  return { operatorId: '_all', jobs: queueJobs, totalParts }
}

/**
 * Replicate GET /api/operator/step/[stepId] lookup logic.
 * Returns null when the step is not found or has zero active serials (maps to 404).
 */
function lookupStep(ctx: TestContext, stepId: string): StepViewResponse | null {
  const { jobService, pathService, serialService, noteService } = ctx
  const jobs = jobService.listJobs()

  for (const job of jobs) {
    const paths = pathService.listPathsByJob(job.id)
    for (const path of paths) {
      const totalSteps = path.steps.length
      for (const step of path.steps) {
        if (step.id !== stepId) continue
        const serials = serialService.listSerialsByStepIndex(path.id, step.order)
        if (serials.length === 0) return null
        const isFinalStep = step.order === totalSteps - 1
        const nextStep = isFinalStep ? undefined : path.steps[step.order + 1]
        return {
          job: {
            jobId: job.id, jobName: job.name, pathId: path.id, pathName: path.name,
            stepId: step.id, stepName: step.name, stepOrder: step.order, stepLocation: step.location,
            totalSteps, serialIds: serials.map(s => s.id), partCount: serials.length,
            nextStepName: nextStep?.name, nextStepLocation: nextStep?.location, isFinalStep,
          },
          notes: noteService.getNotesForStep(stepId),
        }
      }
    }
  }
  return null
}

/**
 * Replicate GET /api/operator/work-queue grouping logic.
 */
function aggregateGroupedWork(
  ctx: TestContext,
  userService: ReturnType<typeof createUserService>,
): WorkQueueGroupedResponse {
  const { jobService, pathService, serialService } = ctx
  const jobs = jobService.listJobs()
  const entries: { job: WorkQueueJob; assignedTo: string | undefined }[] = []

  for (const job of jobs) {
    const paths = pathService.listPathsByJob(job.id)
    for (const path of paths) {
      const totalSteps = path.steps.length
      for (const step of path.steps) {
        const serials = serialService.listSerialsByStepIndex(path.id, step.order)
        if (serials.length === 0) continue
        const isFinalStep = step.order === totalSteps - 1
        const nextStep = isFinalStep ? undefined : path.steps[step.order + 1]
        entries.push({
          assignedTo: step.assignedTo,
          job: {
            jobId: job.id, jobName: job.name, pathId: path.id, pathName: path.name,
            stepId: step.id, stepName: step.name, stepOrder: step.order, stepLocation: step.location,
            totalSteps, serialIds: serials.map(s => s.id), partCount: serials.length,
            nextStepName: nextStep?.name, nextStepLocation: nextStep?.location, isFinalStep,
          },
        })
      }
    }
  }

  const users = userService.listUsers()
  const userNameMap = new Map<string, string>()
  for (const u of users) userNameMap.set(u.id, u.name)

  const groupMap = new Map<string | null, WorkQueueJob[]>()
  for (const entry of entries) {
    const key = entry.assignedTo ?? null
    const list = groupMap.get(key)
    if (list) list.push(entry.job)
    else groupMap.set(key, [entry.job])
  }

  const groups: OperatorGroup[] = []
  for (const [operatorId, groupJobs] of groupMap) {
    const totalParts = groupJobs.reduce((sum, j) => sum + j.partCount, 0)
    const operatorName = operatorId ? (userNameMap.get(operatorId) ?? operatorId) : 'Unassigned'
    groups.push({ operatorId, operatorName, jobs: groupJobs, totalParts })
  }

  const totalParts = entries.reduce((sum, e) => sum + e.job.partCount, 0)
  return { groups, totalParts }
}

// ---- Tests ----

describe('Work Queue API Endpoint Unit Tests', () => {
  let ctx: TestContext

  afterEach(() => {
    if (ctx) {
      ctx.cleanup()
      ctx = null as any
    }
  })

  describe('GET /api/operator/queue/_all — All-Work Endpoint', () => {
    it('returns empty jobs array and totalParts 0 when no active serials exist', () => {
      ctx = createTestContext()

      // Create a job with a path but no serials
      const job = ctx.jobService.createJob({ name: 'Empty Job', goalQuantity: 5 })
      ctx.pathService.createPath({
        jobId: job.id,
        name: 'Main Route',
        goalQuantity: 5,
        steps: [{ name: 'Milling' }, { name: 'Inspection' }],
      })

      const response = aggregateAllWork(ctx)

      expect(response.jobs).toEqual([])
      expect(response.totalParts).toBe(0)
      expect(response.operatorId).toBe('_all')
    })
  })

  describe('GET /api/operator/step/[stepId] — Step Endpoint', () => {
    it('returns null (404) for a non-existent step ID', () => {
      ctx = createTestContext()

      // Create some data so the DB isn't empty
      const job = ctx.jobService.createJob({ name: 'Test Job', goalQuantity: 3 })
      const path = ctx.pathService.createPath({
        jobId: job.id,
        name: 'Main Route',
        goalQuantity: 3,
        steps: [{ name: 'Cutting' }, { name: 'Welding' }],
      })
      ctx.serialService.batchCreateSerials(
        { jobId: job.id, pathId: path.id, quantity: 3 },
        'user_test',
      )

      const result = lookupStep(ctx, 'step_does_not_exist')
      expect(result).toBeNull()
    })

    it('returns null (404) for a step that exists but has zero active serials', () => {
      ctx = createTestContext()

      const job = ctx.jobService.createJob({ name: 'Test Job', goalQuantity: 2 })
      const path = ctx.pathService.createPath({
        jobId: job.id,
        name: 'Main Route',
        goalQuantity: 2,
        steps: [{ name: 'Receiving' }, { name: 'Machining' }, { name: 'QC' }],
      })

      // Create serials — they start at step 0
      const serials = ctx.serialService.batchCreateSerials(
        { jobId: job.id, pathId: path.id, quantity: 2 },
        'user_test',
      )

      // Advance all serials past step 0 so it has zero active serials
      for (const serial of serials) {
        ctx.serialService.advanceSerial(serial.id, 'user_test')
      }

      const step0Id = path.steps[0].id
      const result = lookupStep(ctx, step0Id)
      expect(result).toBeNull()
    })
  })

  describe('GET /api/operator/work-queue — Grouped Endpoint', () => {
    it('returns empty groups and totalParts 0 when no work exists', () => {
      ctx = createTestContext()
      const userRepo = new SQLiteUserRepository(ctx.db)
      const userService = createUserService({ users: userRepo })

      // Create a job with a path but no serials
      const job = ctx.jobService.createJob({ name: 'Empty Job', goalQuantity: 5 })
      ctx.pathService.createPath({
        jobId: job.id,
        name: 'Main Route',
        goalQuantity: 5,
        steps: [{ name: 'Assembly' }],
      })

      const response = aggregateGroupedWork(ctx, userService)

      expect(response.groups).toEqual([])
      expect(response.totalParts).toBe(0)
    })

    it('places unassigned steps into a group with operatorId=null and operatorName="Unassigned"', () => {
      ctx = createTestContext()
      const userRepo = new SQLiteUserRepository(ctx.db)
      const userService = createUserService({ users: userRepo })

      // Create a user (to prove unassigned steps don't get this user's name)
      userService.createUser({ name: 'Mike Johnson' })

      // Create a job with serials — steps have no assignedTo by default
      const job = ctx.jobService.createJob({ name: 'Bracket Assembly', goalQuantity: 3 })
      const path = ctx.pathService.createPath({
        jobId: job.id,
        name: 'Main Route',
        goalQuantity: 3,
        steps: [{ name: 'Milling' }, { name: 'Deburring' }],
      })
      ctx.serialService.batchCreateSerials(
        { jobId: job.id, pathId: path.id, quantity: 3 },
        'user_test',
      )

      const response = aggregateGroupedWork(ctx, userService)

      // All work should be in a single "Unassigned" group
      expect(response.groups.length).toBe(1)

      const group = response.groups[0]
      expect(group.operatorId).toBeNull()
      expect(group.operatorName).toBe('Unassigned')
      expect(group.totalParts).toBe(3)
      expect(group.jobs.length).toBe(1) // only step 0 has serials
    })
  })
})
