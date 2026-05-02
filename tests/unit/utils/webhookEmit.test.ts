/**
 * Unit tests for server/utils/webhookEmit.ts
 *
 * Covers: emitWebhookEvent fire-and-forget behavior, resolveUserName,
 * resolveStepName, resolveStepNameByPath, resolvePathInfo,
 * resolvePathInfoByPath, formatWebhookEventType, and buildSummary.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  emitWebhookEvent,
  resolveUserName,
  resolveStepName,
  resolveStepNameByPath,
  resolvePathInfo,
  resolvePathInfoByPath,
  formatWebhookEventType,
} from '~/server/utils/webhookEmit'

// ---- Mock getServices / getRepositories ----

const mockQueueEvent = vi.fn()
const mockGetById = {
  users: vi.fn(),
  parts: vi.fn(),
  paths: vi.fn(),
  jobs: vi.fn(),
}

vi.stubGlobal('getServices', () => ({
  webhookService: { queueEvent: mockQueueEvent },
}))

vi.stubGlobal('getRepositories', () => ({
  users: { getById: mockGetById.users },
  parts: { getById: mockGetById.parts },
  paths: { getById: mockGetById.paths },
  jobs: { getById: mockGetById.jobs },
}))

describe('formatWebhookEventType', () => {
  it('converts snake_case to Title Case', () => {
    expect(formatWebhookEventType('part_advanced')).toBe('Part Advanced')
    expect(formatWebhookEventType('part_force_completed')).toBe('Part Force Completed')
    expect(formatWebhookEventType('job_created')).toBe('Job Created')
    expect(formatWebhookEventType('step_override_reversed')).toBe('Step Override Reversed')
    expect(formatWebhookEventType('deferred_step_completed')).toBe('Deferred Step Completed')
  })

  it('handles single-word event types', () => {
    expect(formatWebhookEventType('test')).toBe('Test')
  })
})

describe('resolveUserName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns displayName when user has one', () => {
    mockGetById.users.mockReturnValue({ id: 'u1', displayName: 'Alice', username: 'alice' })
    expect(resolveUserName('u1')).toBe('Alice')
  })

  it('falls back to username when displayName is missing', () => {
    mockGetById.users.mockReturnValue({ id: 'u1', username: 'bob' })
    expect(resolveUserName('u1')).toBe('bob')
  })

  it('returns "system" when user is not found', () => {
    mockGetById.users.mockReturnValue(undefined)
    expect(resolveUserName('nonexistent')).toBe('system')
  })

  it('returns "system" when repository throws', () => {
    mockGetById.users.mockImplementation(() => {
      throw new Error('DB error')
    })
    expect(resolveUserName('u1')).toBe('system')
  })
})

describe('resolveStepName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns step name when part and path exist', () => {
    mockGetById.parts.mockReturnValue({ id: 'p1', pathId: 'path1' })
    mockGetById.paths.mockReturnValue({
      id: 'path1',
      steps: [
        { id: 'step1', name: 'Machining' },
        { id: 'step2', name: 'Inspection' },
      ],
    })
    expect(resolveStepName('p1', 'step2')).toBe('Inspection')
  })

  it('returns undefined when step is not found in path', () => {
    mockGetById.parts.mockReturnValue({ id: 'p1', pathId: 'path1' })
    mockGetById.paths.mockReturnValue({
      id: 'path1',
      steps: [{ id: 'step1', name: 'Machining' }],
    })
    expect(resolveStepName('p1', 'nonexistent')).toBeUndefined()
  })

  it('returns undefined when part is not found', () => {
    mockGetById.parts.mockReturnValue(undefined)
    expect(resolveStepName('nonexistent', 'step1')).toBeUndefined()
  })

  it('returns undefined when path is not found', () => {
    mockGetById.parts.mockReturnValue({ id: 'p1', pathId: 'path1' })
    mockGetById.paths.mockReturnValue(undefined)
    expect(resolveStepName('p1', 'step1')).toBeUndefined()
  })

  it('returns undefined when repository throws', () => {
    mockGetById.parts.mockImplementation(() => {
      throw new Error('DB error')
    })
    expect(resolveStepName('p1', 'step1')).toBeUndefined()
  })
})

describe('resolveStepNameByPath', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns step name when path exists and step is found', () => {
    mockGetById.paths.mockReturnValue({
      id: 'path1',
      steps: [
        { id: 'step1', name: 'Machining' },
        { id: 'step2', name: 'Inspection' },
      ],
    })
    expect(resolveStepNameByPath('path1', 'step1')).toBe('Machining')
  })

  it('returns undefined when path is not found', () => {
    mockGetById.paths.mockReturnValue(undefined)
    expect(resolveStepNameByPath('nonexistent', 'step1')).toBeUndefined()
  })

  it('returns undefined when step is not in path', () => {
    mockGetById.paths.mockReturnValue({
      id: 'path1',
      steps: [{ id: 'step1', name: 'Machining' }],
    })
    expect(resolveStepNameByPath('path1', 'step99')).toBeUndefined()
  })

  it('returns undefined when repository throws', () => {
    mockGetById.paths.mockImplementation(() => {
      throw new Error('DB error')
    })
    expect(resolveStepNameByPath('path1', 'step1')).toBeUndefined()
  })
})

describe('resolvePathInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns full path info when all lookups succeed', () => {
    mockGetById.parts.mockReturnValue({ id: 'p1', pathId: 'path1', jobId: 'job1' })
    mockGetById.paths.mockReturnValue({ id: 'path1', name: 'Main Route' })
    mockGetById.jobs.mockReturnValue({ id: 'job1', name: 'Job Alpha' })

    expect(resolvePathInfo('p1')).toEqual({
      pathId: 'path1',
      pathName: 'Main Route',
      jobId: 'job1',
      jobName: 'Job Alpha',
    })
  })

  it('returns undefined when part is not found', () => {
    mockGetById.parts.mockReturnValue(undefined)
    expect(resolvePathInfo('nonexistent')).toBeUndefined()
  })

  it('returns undefined when path is not found', () => {
    mockGetById.parts.mockReturnValue({ id: 'p1', pathId: 'path1', jobId: 'job1' })
    mockGetById.paths.mockReturnValue(undefined)
    expect(resolvePathInfo('p1')).toBeUndefined()
  })

  it('returns undefined when job is not found', () => {
    mockGetById.parts.mockReturnValue({ id: 'p1', pathId: 'path1', jobId: 'job1' })
    mockGetById.paths.mockReturnValue({ id: 'path1', name: 'Main Route' })
    mockGetById.jobs.mockReturnValue(undefined)
    expect(resolvePathInfo('p1')).toBeUndefined()
  })

  it('returns undefined when repository throws', () => {
    mockGetById.parts.mockImplementation(() => {
      throw new Error('DB error')
    })
    expect(resolvePathInfo('p1')).toBeUndefined()
  })
})

describe('resolvePathInfoByPath', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns path and job info when lookups succeed', () => {
    mockGetById.paths.mockReturnValue({ id: 'path1', name: 'Main Route', jobId: 'job1' })
    mockGetById.jobs.mockReturnValue({ id: 'job1', name: 'Job Alpha' })

    expect(resolvePathInfoByPath('path1')).toEqual({
      pathId: 'path1',
      pathName: 'Main Route',
      jobId: 'job1',
      jobName: 'Job Alpha',
    })
  })

  it('returns undefined when path is not found', () => {
    mockGetById.paths.mockReturnValue(undefined)
    expect(resolvePathInfoByPath('nonexistent')).toBeUndefined()
  })

  it('returns undefined when job is not found', () => {
    mockGetById.paths.mockReturnValue({ id: 'path1', name: 'Main Route', jobId: 'job1' })
    mockGetById.jobs.mockReturnValue(undefined)
    expect(resolvePathInfoByPath('path1')).toBeUndefined()
  })

  it('returns undefined when repository throws', () => {
    mockGetById.paths.mockImplementation(() => {
      throw new Error('DB error')
    })
    expect(resolvePathInfoByPath('path1')).toBeUndefined()
  })
})

describe('emitWebhookEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls webhookService.queueEvent with correct eventType and payload', () => {
    emitWebhookEvent('job_created', {
      user: 'Alice',
      jobId: 'job1',
      jobName: 'Test Job',
      goalQuantity: 50,
    })

    expect(mockQueueEvent).toHaveBeenCalledOnce()
    const call = mockQueueEvent.mock.calls[0][0]
    expect(call.eventType).toBe('job_created')
    expect(call.payload).toEqual({
      user: 'Alice',
      jobId: 'job1',
      jobName: 'Test Job',
      goalQuantity: 50,
    })
  })

  it('uses provided summary when given', () => {
    emitWebhookEvent('part_advanced', {
      user: 'Bob',
      partId: 'p1',
    }, 'Custom summary')

    const call = mockQueueEvent.mock.calls[0][0]
    expect(call.summary).toBe('Custom summary')
  })

  it('auto-generates summary when not provided', () => {
    emitWebhookEvent('part_advanced', {
      user: 'Bob',
      partId: 'p1',
      fromStep: 'Step 1',
      toStep: 'Step 2',
    })

    const call = mockQueueEvent.mock.calls[0][0]
    expect(call.summary).toContain('Part Advanced')
    expect(call.summary).toContain('Bob')
    expect(call.summary).toContain('p1')
    expect(call.summary).toContain('Step 1 → Step 2')
  })

  it('auto-generates summary with partIds for batch events', () => {
    emitWebhookEvent('part_advanced', {
      user: 'Alice',
      partIds: ['p1', 'p2', 'p3'],
      advancedCount: 3,
    })

    const call = mockQueueEvent.mock.calls[0][0]
    expect(call.summary).toContain('Part Advanced')
    expect(call.summary).toContain('Alice')
    expect(call.summary).toContain('p1')
  })

  it('truncates partIds in summary when more than 3', () => {
    emitWebhookEvent('part_advanced', {
      user: 'Alice',
      partIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
      advancedCount: 5,
    })

    const call = mockQueueEvent.mock.calls[0][0]
    expect(call.summary).toContain('+2 more')
  })

  it('includes pathName in summary when present', () => {
    emitWebhookEvent('part_advanced', {
      user: 'Bob',
      partId: 'p1',
      pathName: 'Main Route',
    })

    const call = mockQueueEvent.mock.calls[0][0]
    expect(call.summary).toContain('path: Main Route')
  })

  it('includes stepName in summary when present', () => {
    emitWebhookEvent('step_skipped', {
      user: 'Bob',
      partId: 'p1',
      stepId: 's1',
      stepName: 'Deburring',
    })

    const call = mockQueueEvent.mock.calls[0][0]
    expect(call.summary).toContain('Deburring')
  })

  it('silently swallows errors from queueEvent', () => {
    mockQueueEvent.mockImplementation(() => {
      throw new Error('DB down')
    })

    // Should not throw
    expect(() => emitWebhookEvent('job_created', {
      user: 'Alice',
      jobId: 'job1',
      jobName: 'Test',
      goalQuantity: 10,
    })).not.toThrow()
  })

  it('silently swallows errors from getServices', () => {
    vi.stubGlobal('getServices', () => {
      throw new Error('Not initialized')
    })

    expect(() => emitWebhookEvent('job_created', {
      user: 'Alice',
      jobId: 'job1',
      jobName: 'Test',
      goalQuantity: 10,
    })).not.toThrow()

    // Restore
    vi.stubGlobal('getServices', () => ({
      webhookService: { queueEvent: mockQueueEvent },
    }))
  })
})
