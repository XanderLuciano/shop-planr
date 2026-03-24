/**
 * Integration: Operator View
 *
 * Seed multi-step jobs → verify current/coming/backlog.
 * Validates: Requirements 15(Operator).1–15(Operator).7
 *
 * Note: The operator view logic lives in the API route, so we replicate
 * the same aggregation logic here against the service layer directly.
 */
import { describe, it, afterEach, expect } from 'vitest'
import { createTestContext, type TestContext } from './helpers'

/** Replicates the operator view aggregation from server/api/operator/[stepName].get.ts */
function getOperatorView(ctx: TestContext, stepName: string) {
  const { jobService, pathService, serialService } = ctx
  const jobs = jobService.listJobs()

  const currentParts: Array<{ serialId: string, jobName: string, pathName: string, nextStepName?: string, nextStepLocation?: string }> = []
  const comingSoon: Array<{ serialId: string, jobName: string, pathName: string }> = []
  const backlog: Array<{ serialId: string, jobName: string, pathName: string }> = []

  for (const job of jobs) {
    const paths = pathService.listPathsByJob(job.id)
    for (const path of paths) {
      const stepIndex = path.steps.findIndex(s => s.name === stepName)
      if (stepIndex === -1) continue

      // Current parts at this step
      const atStep = serialService.listSerialsByStepIndex(path.id, stepIndex)
      for (const sn of atStep) {
        const nextStep = path.steps[stepIndex + 1]
        currentParts.push({
          serialId: sn.id,
          jobName: job.name,
          pathName: path.name,
          nextStepName: nextStep?.name,
          nextStepLocation: nextStep?.location
        })
      }

      // Coming soon (one step upstream)
      if (stepIndex > 0) {
        const upstream = serialService.listSerialsByStepIndex(path.id, stepIndex - 1)
        for (const sn of upstream) {
          comingSoon.push({ serialId: sn.id, jobName: job.name, pathName: path.name })
        }
      }

      // Backlog (two+ steps upstream)
      for (let i = 0; i < stepIndex - 1; i++) {
        const far = serialService.listSerialsByStepIndex(path.id, i)
        for (const sn of far) {
          backlog.push({ serialId: sn.id, jobName: job.name, pathName: path.name })
        }
      }
    }
  }

  return { currentParts, comingSoon, backlog }
}

describe('Operator View Integration', () => {
  let ctx: TestContext

  afterEach(() => ctx?.cleanup())

  it('shows current parts at selected step across multiple jobs', () => {
    ctx = createTestContext()
    const { jobService, pathService, serialService } = ctx

    // Job 1: 3-step path, 3 SNs at step 1 ("Weld")
    const job1 = jobService.createJob({ name: 'Job Alpha', goalQuantity: 5 })
    const path1 = pathService.createPath({
      jobId: job1.id,
      name: 'Route A',
      goalQuantity: 5,
      steps: [
        { name: 'Cut', location: 'Machine Shop' },
        { name: 'Weld', location: 'Weld Bay' },
        { name: 'Inspect', location: 'QC Lab' }
      ]
    })
    const serials1 = serialService.batchCreateSerials(
      { jobId: job1.id, pathId: path1.id, quantity: 3 },
      'op1'
    )
    // Advance all 3 to "Weld" (step 1)
    for (const sn of serials1) {
      serialService.advanceSerial(sn.id, 'op1')
    }

    // Job 2: different path but also has "Weld" step, 2 SNs at "Weld"
    const job2 = jobService.createJob({ name: 'Job Beta', goalQuantity: 4 })
    const path2 = pathService.createPath({
      jobId: job2.id,
      name: 'Route B',
      goalQuantity: 4,
      steps: [
        { name: 'Mill', location: 'Machine Shop' },
        { name: 'Weld', location: 'Weld Bay' },
        { name: 'Coat', location: 'Vendor - Anodize Co.' }
      ]
    })
    const serials2 = serialService.batchCreateSerials(
      { jobId: job2.id, pathId: path2.id, quantity: 4 },
      'op1'
    )
    // Advance 2 to "Weld"
    for (let i = 0; i < 2; i++) {
      serialService.advanceSerial(serials2[i].id, 'op1')
    }

    const view = getOperatorView(ctx, 'Weld')
    expect(view.currentParts).toHaveLength(5) // 3 from job1 + 2 from job2
    expect(view.currentParts.some(p => p.jobName === 'Job Alpha')).toBe(true)
    expect(view.currentParts.some(p => p.jobName === 'Job Beta')).toBe(true)
  })

  it('shows coming soon (one step upstream) and backlog (two+ steps upstream)', () => {
    ctx = createTestContext()
    const { jobService, pathService, serialService } = ctx

    const job = jobService.createJob({ name: 'Upstream Job', goalQuantity: 10 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Long Route',
      goalQuantity: 10,
      steps: [
        { name: 'Raw', location: 'Receiving' },
        { name: 'Cut', location: 'Machine Shop' },
        { name: 'Weld', location: 'Weld Bay' },
        { name: 'Inspect', location: 'QC Lab' }
      ]
    })

    const serials = serialService.batchCreateSerials(
      { jobId: job.id, pathId: path.id, quantity: 10 },
      'op1'
    )

    // 3 at step 0 (Raw) — backlog for "Inspect"
    // 3 at step 1 (Cut) — backlog for "Inspect", coming soon for "Weld"
    // 2 at step 2 (Weld) — coming soon for "Inspect"
    // 2 at step 3 (Inspect) — current for "Inspect"

    // Advance serials[0..6] to step 1 (Cut)
    for (let i = 0; i < 7; i++) {
      serialService.advanceSerial(serials[i].id, 'op1')
    }
    // Advance serials[0..3] to step 2 (Weld)
    for (let i = 0; i < 4; i++) {
      serialService.advanceSerial(serials[i].id, 'op1')
    }
    // Advance serials[0..1] to step 3 (Inspect)
    for (let i = 0; i < 2; i++) {
      serialService.advanceSerial(serials[i].id, 'op1')
    }

    // Distribution: step 0 = 3, step 1 = 3, step 2 = 2, step 3 = 2
    const inspectView = getOperatorView(ctx, 'Inspect')
    expect(inspectView.currentParts).toHaveLength(2)
    expect(inspectView.comingSoon).toHaveLength(2) // at Weld (one step before Inspect)
    expect(inspectView.backlog).toHaveLength(6) // 3 at Raw + 3 at Cut (two+ steps before)

    // Check "Weld" view
    const weldView = getOperatorView(ctx, 'Weld')
    expect(weldView.currentParts).toHaveLength(2)
    expect(weldView.comingSoon).toHaveLength(3) // at Cut (one step before Weld)
    expect(weldView.backlog).toHaveLength(3) // at Raw (two steps before Weld)
  })

  it('shows next step name and location for current parts', () => {
    ctx = createTestContext()
    const { jobService, pathService, serialService } = ctx

    const job = jobService.createJob({ name: 'Next Step Job', goalQuantity: 2 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 2,
      steps: [
        { name: 'Cut', location: 'Machine Shop' },
        { name: 'Coat', location: 'Vendor - Anodize Co.' },
        { name: 'Final QC', location: 'QC Lab' }
      ]
    })

    const serials = serialService.batchCreateSerials(
      { jobId: job.id, pathId: path.id, quantity: 2 },
      'op1'
    )

    const view = getOperatorView(ctx, 'Cut')
    expect(view.currentParts).toHaveLength(2)
    // Each part at "Cut" should show next step = "Coat" at "Vendor - Anodize Co."
    for (const part of view.currentParts) {
      expect(part.nextStepName).toBe('Coat')
      expect(part.nextStepLocation).toBe('Vendor - Anodize Co.')
    }
  })

  it('switching step updates the view', () => {
    ctx = createTestContext()
    const { jobService, pathService, serialService } = ctx

    const job = jobService.createJob({ name: 'Switch Job', goalQuantity: 4 })
    const path = pathService.createPath({
      jobId: job.id,
      name: 'Route',
      goalQuantity: 4,
      steps: [{ name: 'A' }, { name: 'B' }, { name: 'C' }]
    })

    const serials = serialService.batchCreateSerials(
      { jobId: job.id, pathId: path.id, quantity: 4 },
      'op1'
    )

    // 2 at A, 1 at B, 1 at C
    serialService.advanceSerial(serials[0].id, 'op1') // → B
    serialService.advanceSerial(serials[1].id, 'op1') // → B
    serialService.advanceSerial(serials[0].id, 'op1') // → C

    const viewA = getOperatorView(ctx, 'A')
    expect(viewA.currentParts).toHaveLength(2)

    const viewB = getOperatorView(ctx, 'B')
    expect(viewB.currentParts).toHaveLength(1)
    expect(viewB.comingSoon).toHaveLength(2) // 2 at step A

    const viewC = getOperatorView(ctx, 'C')
    expect(viewC.currentParts).toHaveLength(1)
    expect(viewC.comingSoon).toHaveLength(1) // 1 at step B
    expect(viewC.backlog).toHaveLength(2) // 2 at step A
  })
})
