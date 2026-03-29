import { describe, it, expect } from 'vitest'
import type { WorkQueueJob } from '~/server/types/computed'

/**
 * Pure filter function extracted from usePartsView composable.
 * Tests the search logic without Vue reactivity or API calls.
 *
 * Validates: Requirements 1.6, 1.7, 5.7
 */
function filterJobs(jobs: WorkQueueJob[], query: string): WorkQueueJob[] {
  const q = query.trim().toLowerCase()
  if (!q) return jobs
  return jobs.filter(
    (job) =>
      job.jobName.toLowerCase().includes(q) ||
      job.pathName.toLowerCase().includes(q) ||
      job.stepName.toLowerCase().includes(q)
  )
}

function makeJob(overrides: Partial<WorkQueueJob> = {}): WorkQueueJob {
  return {
    jobId: 'job_1',
    jobName: 'Default Job',
    pathId: 'path_1',
    pathName: 'Main Route',
    stepId: 'step_1',
    stepName: 'Default Step',
    stepOrder: 0,
    totalSteps: 3,
    partIds: ['part_1'],
    partCount: 1,
    isFinalStep: false,
    ...overrides,
  }
}

const sampleJobs: WorkQueueJob[] = [
  makeJob({
    jobId: 'j1',
    jobName: 'Bracket Assembly',
    pathName: 'Main Route',
    stepName: 'Milling',
    stepId: 's1',
  }),
  makeJob({
    jobId: 'j2',
    jobName: 'Housing Unit',
    pathName: 'Primary Path',
    stepName: 'Receiving',
    stepId: 's2',
  }),
  makeJob({
    jobId: 'j3',
    jobName: 'Shaft Job',
    pathName: 'Main Route',
    stepName: 'Turning',
    stepId: 's3',
  }),
  makeJob({
    jobId: 'j1',
    jobName: 'Bracket Assembly',
    pathName: 'Main Route',
    stepName: 'Deburring',
    stepId: 's4',
  }),
]

describe('Work Queue Search Filter', () => {
  it('empty string returns all jobs', () => {
    const result = filterJobs(sampleJobs, '')
    expect(result).toHaveLength(sampleJobs.length)
    expect(result).toEqual(sampleJobs)
  })

  it('whitespace-only search returns all jobs', () => {
    const result = filterJobs(sampleJobs, '   ')
    expect(result).toHaveLength(sampleJobs.length)
  })

  it('"mill" matches a job with stepName "Milling" (case-insensitive)', () => {
    const result = filterJobs(sampleJobs, 'mill')
    expect(result).toHaveLength(1)
    expect(result[0].stepName).toBe('Milling')
  })

  it('"bracket" matches jobs with jobName "Bracket Assembly"', () => {
    const result = filterJobs(sampleJobs, 'bracket')
    expect(result).toHaveLength(2)
    expect(result.every((j) => j.jobName === 'Bracket Assembly')).toBe(true)
  })

  it('"primary" matches by pathName', () => {
    const result = filterJobs(sampleJobs, 'primary')
    expect(result).toHaveLength(1)
    expect(result[0].pathName).toBe('Primary Path')
  })

  it('search that matches nothing returns empty array', () => {
    const result = filterJobs(sampleJobs, 'nonexistent')
    expect(result).toHaveLength(0)
  })

  it('case-insensitive: "TURNING" matches stepName "Turning"', () => {
    const result = filterJobs(sampleJobs, 'TURNING')
    expect(result).toHaveLength(1)
    expect(result[0].stepName).toBe('Turning')
  })

  it('mixed case: "HoUsInG" matches jobName "Housing Unit"', () => {
    const result = filterJobs(sampleJobs, 'HoUsInG')
    expect(result).toHaveLength(1)
    expect(result[0].jobName).toBe('Housing Unit')
  })

  it('search with leading/trailing whitespace is trimmed', () => {
    const result = filterJobs(sampleJobs, '  mill  ')
    expect(result).toHaveLength(1)
    expect(result[0].stepName).toBe('Milling')
  })

  it('filtering an empty jobs array returns empty', () => {
    const result = filterJobs([], 'anything')
    expect(result).toHaveLength(0)
  })
})
