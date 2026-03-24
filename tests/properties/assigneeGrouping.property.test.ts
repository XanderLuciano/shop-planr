/**
 * Property 6: Assignee Grouping Correctness
 *
 * For any set of jobs with paths whose steps have various assignedTo values
 * (some set to user IDs, some undefined), the grouped work-queue endpoint should:
 * place each WorkQueueJob entry into the group matching its step's assignedTo value;
 * resolve operatorName to the matching ShopUser.name for assigned steps;
 * place steps with no assignedTo into a group with operatorId = null and
 * operatorName = "Unassigned"; and ensure every active step appears in exactly one group.
 *
 * **Validates: Requirements 4.2, 4.3, 4.4**
 */
import { describe, it, afterEach, expect } from 'vitest'
import fc from 'fast-check'
import { createTestContext, type TestContext } from '../integration/helpers'
import { SQLiteUserRepository } from '../../server/repositories/sqlite/userRepository'
import { createUserService } from '../../server/services/userService'
import type { WorkQueueJob, OperatorGroup, WorkQueueGroupedResponse } from '../../server/types/computed'

/**
 * Replicate the grouping logic from server/api/operator/work-queue.get.ts
 * as a pure function operating on the test context services + userService.
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

  // Build userId → name lookup
  const users = userService.listUsers()
  const userNameMap = new Map<string, string>()
  for (const u of users) {
    userNameMap.set(u.id, u.name)
  }

  // Group entries by assignedTo
  const groupMap = new Map<string | null, WorkQueueJob[]>()
  for (const entry of entries) {
    const key = entry.assignedTo ?? null
    const list = groupMap.get(key)
    if (list) {
      list.push(entry.job)
    } else {
      groupMap.set(key, [entry.job])
    }
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

/** Arbitrary for assignment config: which steps get assigned to which user index */
interface StepAssignment {
  stepIndex: number
  userIndex: number | null // null = unassigned
}

/** Arbitrary for a single job/path config with assignment info */
const jobPathConfigArb = fc.record({
  jobName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  pathName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  stepCount: fc.integer({ min: 1, max: 4 }),
  serialCount: fc.integer({ min: 1, max: 5 }),
  stepLocations: fc.array(
    fc.option(fc.string({ minLength: 1, maxLength: 15 }).filter(s => s.trim().length > 0), { nil: undefined }),
    { minLength: 4, maxLength: 4 },
  ),
  /** Which steps to assign and to which user index (null = leave unassigned) */
  assignments: fc.array(
    fc.record({
      stepIndex: fc.integer({ min: 0, max: 3 }),
      userIndex: fc.option(fc.integer({ min: 0, max: 2 }), { nil: null }),
    }),
    { minLength: 0, maxLength: 4 },
  ),
})

/** Generate 1-3 user names for the scenario */
const userNamesArb = fc.array(
  fc.string({ minLength: 1, maxLength: 15 }).filter(s => s.trim().length > 0),
  { minLength: 1, maxLength: 3 },
)

/** Full scenario: multiple jobs + user names */
const scenarioArb = fc.record({
  configs: fc.array(jobPathConfigArb, { minLength: 1, maxLength: 3 }),
  userNames: userNamesArb,
})

describe('Property 6: Assignee Grouping Correctness', () => {
  let ctx: TestContext

  afterEach(() => {
    if (ctx) {
      ctx.cleanup()
      ctx = null as any
    }
  })

  it('groups work by assignedTo, resolves operator names, and handles unassigned correctly', () => {
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        ctx = createTestContext()
        const { jobService, pathService, serialService, db } = ctx

        // Create userService from the same DB
        const userRepo = new SQLiteUserRepository(db)
        const userService = createUserService({ users: userRepo })

        // Create users
        const createdUsers = scenario.userNames.map(name =>
          userService.createUser({ name }),
        )

        // Track expected: stepId → assignedTo (userId or undefined)
        const stepAssignments = new Map<string, string | undefined>()
        // Track which steps have active serials
        const activeStepIds = new Set<string>()
        // Track step metadata for verification
        const stepToJob = new Map<string, { jobId: string; jobName: string; pathId: string; pathName: string }>()

        for (const config of scenario.configs) {
          const job = jobService.createJob({
            name: config.jobName,
            goalQuantity: config.serialCount,
          })

          const steps = Array.from({ length: config.stepCount }, (_, i) => ({
            name: `Step-${i}`,
            location: config.stepLocations[i],
          }))

          const path = pathService.createPath({
            jobId: job.id,
            name: config.pathName,
            goalQuantity: config.serialCount,
            steps,
          })

          // Create serials (all start at step 0)
          serialService.batchCreateSerials(
            { jobId: job.id, pathId: path.id, quantity: config.serialCount },
            'user_test',
          )

          // Record step metadata
          for (const step of path.steps) {
            stepToJob.set(step.id, {
              jobId: job.id,
              jobName: job.name,
              pathId: path.id,
              pathName: path.name,
            })
            // Only step 0 has active serials (we don't advance)
            if (step.order === 0) {
              activeStepIds.add(step.id)
            }
            stepAssignments.set(step.id, undefined)
          }

          // Apply assignments using direct DB update (pathService in test context
          // doesn't have users repo, so we use the repo directly)
          for (const assignment of config.assignments) {
            if (assignment.stepIndex >= config.stepCount) continue
            const step = path.steps[assignment.stepIndex]

            if (assignment.userIndex !== null && assignment.userIndex < createdUsers.length) {
              const userId = createdUsers[assignment.userIndex].id
              ctx.repos.paths.updateStepAssignment(step.id, userId)
              stepAssignments.set(step.id, userId)
            } else {
              // Leave unassigned (or explicitly set to null)
              ctx.repos.paths.updateStepAssignment(step.id, null)
              stepAssignments.set(step.id, undefined)
            }
          }
        }

        // Run the aggregation
        const response = aggregateGroupedWork(ctx, userService)

        // Build expected grouping: assignedTo → set of active stepIds
        const expectedGroups = new Map<string | null, Set<string>>()
        for (const stepId of activeStepIds) {
          const assignedTo = stepAssignments.get(stepId) ?? null
          if (!expectedGroups.has(assignedTo)) expectedGroups.set(assignedTo, new Set())
          expectedGroups.get(assignedTo)!.add(stepId)
        }

        // Build userId → name map for verification
        const userNameMap = new Map<string, string>()
        for (const u of createdUsers) {
          userNameMap.set(u.id, u.name)
        }

        // 1. Every active step appears in exactly one group
        const allResponseStepIds = new Set<string>()
        for (const group of response.groups) {
          for (const job of group.jobs) {
            expect(allResponseStepIds.has(job.stepId)).toBe(false) // no duplicates
            allResponseStepIds.add(job.stepId)
          }
        }
        expect(allResponseStepIds.size).toBe(activeStepIds.size)
        for (const stepId of activeStepIds) {
          expect(allResponseStepIds.has(stepId)).toBe(true)
        }

        // 2. Each WorkQueueJob is in the group matching its step's assignedTo
        for (const group of response.groups) {
          for (const job of group.jobs) {
            const expectedAssignedTo = stepAssignments.get(job.stepId) ?? null
            expect(group.operatorId).toBe(expectedAssignedTo)
          }
        }

        // 3. Operator name resolution: assigned groups have correct ShopUser.name
        for (const group of response.groups) {
          if (group.operatorId !== null) {
            const expectedName = userNameMap.get(group.operatorId)
            expect(expectedName).toBeDefined()
            expect(group.operatorName).toBe(expectedName)
          }
        }

        // 4. Unassigned group has operatorId = null and operatorName = "Unassigned"
        const unassignedGroup = response.groups.find(g => g.operatorId === null)
        if (expectedGroups.has(null)) {
          expect(unassignedGroup).toBeDefined()
          expect(unassignedGroup!.operatorName).toBe('Unassigned')
        }

        // 5. Number of groups matches expected
        expect(response.groups.length).toBe(expectedGroups.size)

        ctx.cleanup()
        ctx = null as any
      }),
      { numRuns: 100 },
    )
  })
})
