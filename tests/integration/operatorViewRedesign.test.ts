/**
 * Integration: Operator View Redesign
 *
 * End-to-end tests for the three new API endpoints:
 *   - GET /api/operator/queue/_all (all-work)
 *   - GET /api/operator/step/[stepId] (step view)
 *   - GET /api/operator/work-queue (grouped by assignee)
 *
 * Each test creates realistic data scenarios and verifies behavior by
 * replicating endpoint logic as pure functions against the service layer.
 *
 * Validates: Requirements 1.2, 2.3, 3.3, 4.2, 4.3, 4.4
 */
import { describe, it, afterEach, expect } from 'vitest'
import { createTestContext, type TestContext } from './helpers'
import { SQLiteUserRepository } from '../../server/repositories/sqlite/userRepository'
import { createUserService } from '../../server/services/userService'
import type {
  WorkQueueJob,
  WorkQueueResponse,
  WorkQueueGroupedResponse,
  OperatorGroup,
  StepViewResponse,
} from '../../server/types/computed'

// ---------------------------------------------------------------------------
// Pure function replications of endpoint logic
// ---------------------------------------------------------------------------

/** Replicates GET /api/operator/queue/_all */
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
          jobId: job.id,
          jobName: job.name,
          pathId: path.id,
          pathName: path.name,
          stepId: step.id,
          stepName: step.name,
          stepOrder: step.order,
          stepLocation: step.location,
          totalSteps,
          serialIds: serials.map(s => s.id),
          partCount: serials.length,
          nextStepName: nextStep?.name,
          nextStepLocation: nextStep?.location,
          isFinalStep,
        })
      }
    }
  }

  const queueJobs = Array.from(groupMap.values())
  const totalParts = queueJobs.reduce((sum, j) => sum + j.partCount, 0)
  return { operatorId: '_all', jobs: queueJobs, totalParts }
}

/** Replicates GET /api/operator/step/[stepId] */
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
        const foundJob: WorkQueueJob = {
          jobId: job.id,
          jobName: job.name,
          pathId: path.id,
          pathName: path.name,
          stepId: step.id,
          stepName: step.name,
          stepOrder: step.order,
          stepLocation: step.location,
          totalSteps,
          serialIds: serials.map(s => s.id),
          partCount: serials.length,
          nextStepName: nextStep?.name,
          nextStepLocation: nextStep?.location,
          isFinalStep,
        }
        const notes = noteService.getNotesForStep(stepId)
        return { job: foundJob, notes }
      }
    }
  }
  return null
}

/** Replicates GET /api/operator/work-queue */
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
            jobId: job.id,
            jobName: job.name,
            pathId: path.id,
            pathName: path.name,
            stepId: step.id,
            stepName: step.name,
            stepOrder: step.order,
            stepLocation: step.location,
            totalSteps,
            serialIds: serials.map(s => s.id),
            partCount: serials.length,
            nextStepName: nextStep?.name,
            nextStepLocation: nextStep?.location,
            isFinalStep,
          },
        })
      }
    }
  }

  const users = userService.listUsers()
  const userNameMap = new Map<string, string>()
  for (const u of users) {
    userNameMap.set(u.id, u.name)
  }

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
    const operatorName = operatorId
      ? (userNameMap.get(operatorId) ?? operatorId)
      : 'Unassigned'
    groups.push({ operatorId, operatorName, jobs: groupJobs, totalParts })
  }

  const totalParts = entries.reduce((sum, e) => sum + e.job.partCount, 0)
  return { groups, totalParts }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Operator View Redesign Integration', () => {
  let ctx: TestContext

  afterEach(() => ctx?.cleanup())

  // ---- 1. Full parts view flow (Validates: Req 1.2) ----

  it('all-work endpoint returns correct WorkQueueJob entries for multiple jobs', () => {
    ctx = createTestContext()
    const { jobService, pathService, serialService } = ctx

    // Job 1: 3-step path, 4 serials — advance 2 to step 1
    const job1 = jobService.createJob({ name: 'Bracket Assembly', goalQuantity: 4 })
    const path1 = pathService.createPath({
      jobId: job1.id,
      name: 'Main Route',
      goalQuantity: 4,
      steps: [
        { name: 'Milling', location: 'CNC Bay 1' },
        { name: 'Deburring', location: 'Bench 3' },
        { name: 'Inspection', location: 'QC Lab' },
      ],
    })
    const serials1 = serialService.batchCreateSerials(
      { jobId: job1.id, pathId: path1.id, quantity: 4 },
      'op1',
    )
    // Advance first 2 serials to Deburring (step 1)
    serialService.advanceSerial(serials1[0].id, 'op1')
    serialService.advanceSerial(serials1[1].id, 'op1')

    // Job 2: 2-step path, 3 serials — all at step 0
    const job2 = jobService.createJob({ name: 'Housing Unit', goalQuantity: 3 })
    const path2 = pathService.createPath({
      jobId: job2.id,
      name: 'Primary Path',
      goalQuantity: 3,
      steps: [
        { name: 'Receiving', location: 'Dock A' },
        { name: 'Machining', location: 'CNC Bay 2' },
      ],
    })
    serialService.batchCreateSerials(
      { jobId: job2.id, pathId: path2.id, quantity: 3 },
      'op1',
    )

    const response = aggregateAllWork(ctx)

    // Should have 3 groups: job1/step0 (2 parts), job1/step1 (2 parts), job2/step0 (3 parts)
    expect(response.jobs).toHaveLength(3)
    expect(response.totalParts).toBe(7)
    expect(response.operatorId).toBe('_all')

    // Verify job1 step 0 (Milling) — 2 remaining serials
    const milling = response.jobs.find(
      j => j.jobId === job1.id && j.stepOrder === 0,
    )!
    expect(milling).toBeDefined()
    expect(milling.stepName).toBe('Milling')
    expect(milling.stepLocation).toBe('CNC Bay 1')
    expect(milling.pathName).toBe('Main Route')
    expect(milling.jobName).toBe('Bracket Assembly')
    expect(milling.partCount).toBe(2)
    expect(milling.totalSteps).toBe(3)
    expect(milling.nextStepName).toBe('Deburring')
    expect(milling.isFinalStep).toBe(false)

    // Verify job1 step 1 (Deburring) — 2 advanced serials
    const deburring = response.jobs.find(
      j => j.jobId === job1.id && j.stepOrder === 1,
    )!
    expect(deburring).toBeDefined()
    expect(deburring.stepName).toBe('Deburring')
    expect(deburring.partCount).toBe(2)
    expect(deburring.nextStepName).toBe('Inspection')

    // Verify job2 step 0 (Receiving) — 3 serials
    const receiving = response.jobs.find(
      j => j.jobId === job2.id && j.stepOrder === 0,
    )!
    expect(receiving).toBeDefined()
    expect(receiving.stepName).toBe('Receiving')
    expect(receiving.partCount).toBe(3)
    expect(receiving.jobName).toBe('Housing Unit')
    expect(receiving.pathName).toBe('Primary Path')
  })

  // ---- 2. Step view navigation (Validates: Req 2.3) ----

  it('step endpoint returns correct data for a specific step ID', () => {
    ctx = createTestContext()
    const { jobService, pathService, serialService } = ctx

    const job = jobService.createJob({ name: 'Shaft Job', goalQuantity: 5 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Main Route',
      goalQuantity: 5,
      steps: [
        { name: 'Turning', location: 'Lathe 1' },
        { name: 'Grinding', location: 'Grinder Bay' },
        { name: 'Final QC', location: 'QC Lab' },
      ],
    })
    const serials = serialService.batchCreateSerials(
      { jobId: job.id, pathId: path.id, quantity: 5 },
      'op1',
    )

    // Advance 3 serials to Grinding (step 1)
    for (let i = 0; i < 3; i++) {
      serialService.advanceSerial(serials[i].id, 'op1')
    }

    // Look up the Grinding step
    const grindingStep = path.steps[1]
    const result = lookupStep(ctx, grindingStep.id)

    expect(result).not.toBeNull()
    const { job: wqJob, notes } = result!

    // Verify job/path metadata
    expect(wqJob.jobId).toBe(job.id)
    expect(wqJob.jobName).toBe('Shaft Job')
    expect(wqJob.pathId).toBe(path.id)
    expect(wqJob.pathName).toBe('Main Route')

    // Verify step metadata
    expect(wqJob.stepId).toBe(grindingStep.id)
    expect(wqJob.stepName).toBe('Grinding')
    expect(wqJob.stepOrder).toBe(1)
    expect(wqJob.stepLocation).toBe('Grinder Bay')
    expect(wqJob.totalSteps).toBe(3)

    // Verify serial IDs — exactly the 3 advanced serials
    expect(wqJob.partCount).toBe(3)
    expect(wqJob.serialIds).toHaveLength(3)
    const advancedIds = new Set(serials.slice(0, 3).map(s => s.id))
    for (const sid of wqJob.serialIds) {
      expect(advancedIds.has(sid)).toBe(true)
    }

    // Verify next step info
    expect(wqJob.nextStepName).toBe('Final QC')
    expect(wqJob.nextStepLocation).toBe('QC Lab')
    expect(wqJob.isFinalStep).toBe(false)

    // Notes should be empty (none created)
    expect(notes).toHaveLength(0)

    // Step with no active serials returns null (404)
    // Advance all 3 grinding serials to Final QC, then to completion
    for (let i = 0; i < 3; i++) {
      serialService.advanceSerial(serials[i].id, 'op1') // → Final QC
    }
    for (let i = 0; i < 3; i++) {
      serialService.advanceSerial(serials[i].id, 'op1') // → completed
    }
    const emptyResult = lookupStep(ctx, grindingStep.id)
    expect(emptyResult).toBeNull()
  })

  // ---- 3. Grouped work queue (Validates: Req 4.2, 4.3, 4.4) ----

  it('grouped endpoint groups work by assignee with correct operator names', () => {
    ctx = createTestContext()
    const { jobService, pathService, serialService, db } = ctx

    // Create users
    const userRepo = new SQLiteUserRepository(db)
    const userService = createUserService({ users: userRepo })
    const mike = userService.createUser({ name: 'Mike Johnson' })
    const sarah = userService.createUser({ name: 'Sarah Chen' })

    // Job with 3 steps: step 0 assigned to Mike, step 1 assigned to Sarah, step 2 unassigned
    const job = jobService.createJob({ name: 'Widget Assembly', goalQuantity: 6 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Standard Route',
      goalQuantity: 6,
      steps: [
        { name: 'Cutting', location: 'Machine Shop' },
        { name: 'Welding', location: 'Weld Bay' },
        { name: 'Painting', location: 'Paint Booth' },
      ],
    })

    // Assign steps
    ctx.repos.paths.updateStepAssignment(path.steps[0].id, mike.id)
    ctx.repos.paths.updateStepAssignment(path.steps[1].id, sarah.id)
    // step 2 left unassigned

    // Create 6 serials, advance some
    const serials = serialService.batchCreateSerials(
      { jobId: job.id, pathId: path.id, quantity: 6 },
      'op1',
    )
    // Advance 3 to Welding (step 1)
    for (let i = 0; i < 3; i++) {
      serialService.advanceSerial(serials[i].id, 'op1')
    }
    // Advance 1 to Painting (step 2)
    serialService.advanceSerial(serials[0].id, 'op1')

    // Distribution: step 0 = 3 (Mike), step 1 = 2 (Sarah), step 2 = 1 (Unassigned)
    const response = aggregateGroupedWork(ctx, userService)

    expect(response.totalParts).toBe(6)
    expect(response.groups).toHaveLength(3)

    // Mike's group: step 0 (Cutting) with 3 parts
    const mikeGroup = response.groups.find(g => g.operatorId === mike.id)!
    expect(mikeGroup).toBeDefined()
    expect(mikeGroup.operatorName).toBe('Mike Johnson')
    expect(mikeGroup.jobs).toHaveLength(1)
    expect(mikeGroup.jobs[0].stepName).toBe('Cutting')
    expect(mikeGroup.jobs[0].partCount).toBe(3)
    expect(mikeGroup.totalParts).toBe(3)

    // Sarah's group: step 1 (Welding) with 2 parts
    const sarahGroup = response.groups.find(g => g.operatorId === sarah.id)!
    expect(sarahGroup).toBeDefined()
    expect(sarahGroup.operatorName).toBe('Sarah Chen')
    expect(sarahGroup.jobs).toHaveLength(1)
    expect(sarahGroup.jobs[0].stepName).toBe('Welding')
    expect(sarahGroup.jobs[0].partCount).toBe(2)
    expect(sarahGroup.totalParts).toBe(2)

    // Unassigned group: step 2 (Painting) with 1 part
    const unassignedGroup = response.groups.find(g => g.operatorId === null)!
    expect(unassignedGroup).toBeDefined()
    expect(unassignedGroup.operatorName).toBe('Unassigned')
    expect(unassignedGroup.jobs).toHaveLength(1)
    expect(unassignedGroup.jobs[0].stepName).toBe('Painting')
    expect(unassignedGroup.jobs[0].partCount).toBe(1)
    expect(unassignedGroup.totalParts).toBe(1)
  })

  // ---- 4. Step advancement from step view (Validates: Req 3.3) ----

  it('advancing serials from step view decreases partCount on re-fetch', () => {
    ctx = createTestContext()
    const { jobService, pathService, serialService } = ctx

    const job = jobService.createJob({ name: 'Connector Job', goalQuantity: 4 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Assembly Line',
      goalQuantity: 4,
      steps: [
        { name: 'Prep', location: 'Station A' },
        { name: 'Assembly', location: 'Station B' },
        { name: 'Test', location: 'Station C' },
      ],
    })
    const serials = serialService.batchCreateSerials(
      { jobId: job.id, pathId: path.id, quantity: 4 },
      'op1',
    )

    // All 4 at step 0 (Prep)
    const prepStep = path.steps[0]
    const initial = lookupStep(ctx, prepStep.id)
    expect(initial).not.toBeNull()
    expect(initial!.job.partCount).toBe(4)
    expect(initial!.job.serialIds).toHaveLength(4)

    // Advance 2 serials from Prep → Assembly
    serialService.advanceSerial(serials[0].id, 'op1')
    serialService.advanceSerial(serials[1].id, 'op1')

    // Re-fetch Prep step — should now have 2 parts
    const afterAdvance = lookupStep(ctx, prepStep.id)
    expect(afterAdvance).not.toBeNull()
    expect(afterAdvance!.job.partCount).toBe(2)
    expect(afterAdvance!.job.serialIds).toHaveLength(2)

    // The advanced serials should NOT be in the Prep step anymore
    const remainingIds = new Set(afterAdvance!.job.serialIds)
    expect(remainingIds.has(serials[0].id)).toBe(false)
    expect(remainingIds.has(serials[1].id)).toBe(false)
    expect(remainingIds.has(serials[2].id)).toBe(true)
    expect(remainingIds.has(serials[3].id)).toBe(true)

    // Assembly step should now have 2 parts
    const assemblyStep = path.steps[1]
    const assemblyView = lookupStep(ctx, assemblyStep.id)
    expect(assemblyView).not.toBeNull()
    expect(assemblyView!.job.partCount).toBe(2)

    // Advance all remaining from Prep
    serialService.advanceSerial(serials[2].id, 'op1')
    serialService.advanceSerial(serials[3].id, 'op1')

    // Prep step should now return null (no active parts → 404)
    const emptyPrep = lookupStep(ctx, prepStep.id)
    expect(emptyPrep).toBeNull()

    // Assembly should now have all 4
    const fullAssembly = lookupStep(ctx, assemblyStep.id)
    expect(fullAssembly).not.toBeNull()
    expect(fullAssembly!.job.partCount).toBe(4)
  })
})
