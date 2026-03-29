/**
 * Integration: Template Application
 *
 * Apply template → verify path → customize → verify independence.
 * Validates: Requirements 8.1–8.5
 */
import { describe, it, afterEach, expect } from 'vitest'
import { createTestContext, type TestContext } from './helpers'

describe('Template Application Integration', () => {
  let ctx: TestContext

  afterEach(() => ctx?.cleanup())

  it('create template → apply to job → verify path has same steps', () => {
    ctx = createTestContext()
    const { jobService, templateService } = ctx

    // Create a template with 3 steps
    const template = templateService.createTemplate({
      name: 'Standard Machining',
      steps: [
        { name: 'Cut', location: 'Machine Shop' },
        { name: 'Deburr', location: 'Machine Shop' },
        { name: 'Inspect', location: 'QC Lab' },
      ],
    })
    expect(template.steps).toHaveLength(3)

    // Apply to a job
    const job = jobService.createJob({ name: 'Template Test Job', goalQuantity: 10 })
    const path = templateService.applyTemplate(template.id, {
      jobId: job.id,
      goalQuantity: 10,
    })

    // Verify path has same steps as template
    expect(path.steps).toHaveLength(3)
    expect(path.steps[0].name).toBe('Cut')
    expect(path.steps[0].location).toBe('Machine Shop')
    expect(path.steps[1].name).toBe('Deburr')
    expect(path.steps[2].name).toBe('Inspect')
    expect(path.steps[2].location).toBe('QC Lab')
    expect(path.jobId).toBe(job.id)
  })

  it('modify derived path → original template unchanged', () => {
    ctx = createTestContext()
    const { jobService, pathService, templateService } = ctx

    const template = templateService.createTemplate({
      name: 'Coating Route',
      steps: [{ name: 'Prep' }, { name: 'Coat' }, { name: 'Cure' }],
    })

    const job = jobService.createJob({ name: 'Modify Test', goalQuantity: 5 })
    const path = templateService.applyTemplate(template.id, {
      jobId: job.id,
      goalQuantity: 5,
    })

    // Snapshot template steps before modification
    const templateBefore = templateService.getTemplate(template.id)
    const stepNamesBefore = templateBefore.steps.map((s) => s.name)

    // Modify the derived path: add a step, change order
    pathService.updatePath(path.id, {
      steps: [
        { name: 'Prep' },
        { name: 'Sand' },
        { name: 'Coat' },
        { name: 'Cure' },
        { name: 'Final QC' },
      ],
    })

    // Verify the path was updated
    const updatedPath = pathService.getPath(path.id)
    expect(updatedPath.steps).toHaveLength(5)
    expect(updatedPath.steps[1].name).toBe('Sand')
    expect(updatedPath.steps[4].name).toBe('Final QC')

    // Verify original template is unchanged
    const templateAfter = templateService.getTemplate(template.id)
    const stepNamesAfter = templateAfter.steps.map((s) => s.name)
    expect(stepNamesAfter).toEqual(stepNamesBefore)
    expect(templateAfter.steps).toHaveLength(3)
  })

  it('apply same template to two jobs → paths are independent', () => {
    ctx = createTestContext()
    const { jobService, pathService, templateService } = ctx

    const template = templateService.createTemplate({
      name: 'Shared Template',
      steps: [{ name: 'OP1' }, { name: 'OP2' }],
    })

    const job1 = jobService.createJob({ name: 'Job 1', goalQuantity: 5 })
    const job2 = jobService.createJob({ name: 'Job 2', goalQuantity: 8 })

    const path1 = templateService.applyTemplate(template.id, {
      jobId: job1.id,
      goalQuantity: 5,
    })
    const path2 = templateService.applyTemplate(template.id, {
      jobId: job2.id,
      goalQuantity: 8,
    })

    // Paths have different IDs
    expect(path1.id).not.toBe(path2.id)

    // Steps have different IDs (deep-cloned)
    expect(path1.steps[0].id).not.toBe(path2.steps[0].id)

    // Modify path1 — path2 should be unaffected
    pathService.updatePath(path1.id, {
      steps: [{ name: 'OP1' }, { name: 'OP2' }, { name: 'OP3' }],
    })

    const path2After = pathService.getPath(path2.id)
    expect(path2After.steps).toHaveLength(2)
  })

  it('rejects applying a deleted template', () => {
    ctx = createTestContext()
    const { jobService, templateService } = ctx

    const template = templateService.createTemplate({
      name: 'Doomed Template',
      steps: [{ name: 'Step 1' }],
    })

    templateService.deleteTemplate(template.id)

    const job = jobService.createJob({ name: 'Test', goalQuantity: 5 })
    expect(() =>
      templateService.applyTemplate(template.id, {
        jobId: job.id,
        goalQuantity: 5,
      })
    ).toThrow(/not found/i)
  })
})
