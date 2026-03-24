import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAuditService } from '../../../server/services/auditService'
import type { AuditRepository } from '../../../server/repositories/interfaces/auditRepository'
import type { AuditEntry } from '../../../server/types/domain'

function createMockAuditRepo(): AuditRepository {
  const store: AuditEntry[] = []
  return {
    create: vi.fn((entry: AuditEntry) => {
      store.push(entry)
      return entry
    }),
    listBySerialId: vi.fn((serialId: string) =>
      store.filter(e => e.serialId === serialId).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    ),
    listByJobId: vi.fn((jobId: string) =>
      store.filter(e => e.jobId === jobId)
    ),
    list: vi.fn((options?: { limit?: number, offset?: number }) => {
      const offset = options?.offset ?? 0
      const limit = options?.limit ?? store.length
      return store.slice(offset, offset + limit)
    })
  }
}

describe('AuditService', () => {
  let repo: AuditRepository
  let service: ReturnType<typeof createAuditService>

  beforeEach(() => {
    repo = createMockAuditRepo()
    service = createAuditService({ audit: repo })
  })

  it('recordCertAttachment creates entry with correct action and fields', () => {
    const entry = service.recordCertAttachment({
      userId: 'user_1',
      serialId: 'sn_1',
      certId: 'cert_1',
      stepId: 'step_1',
      jobId: 'job_1',
      pathId: 'path_1'
    })
    expect(entry.action).toBe('cert_attached')
    expect(entry.userId).toBe('user_1')
    expect(entry.serialId).toBe('sn_1')
    expect(entry.certId).toBe('cert_1')
    expect(entry.stepId).toBe('step_1')
    expect(entry.id).toMatch(/^aud_/)
    expect(entry.timestamp).toBeTruthy()
  })

  it('recordSerialCreation creates entry with batch quantity', () => {
    const entry = service.recordSerialCreation({
      userId: 'user_1',
      jobId: 'job_1',
      pathId: 'path_1',
      batchQuantity: 10
    })
    expect(entry.action).toBe('serial_created')
    expect(entry.batchQuantity).toBe(10)
    expect(entry.jobId).toBe('job_1')
  })

  it('recordSerialAdvancement creates entry with from/to steps', () => {
    const entry = service.recordSerialAdvancement({
      userId: 'user_1',
      serialId: 'sn_1',
      fromStepId: 'step_1',
      toStepId: 'step_2'
    })
    expect(entry.action).toBe('serial_advanced')
    expect(entry.fromStepId).toBe('step_1')
    expect(entry.toStepId).toBe('step_2')
  })

  it('recordSerialCompletion creates entry with correct action', () => {
    const entry = service.recordSerialCompletion({
      userId: 'user_1',
      serialId: 'sn_1',
      fromStepId: 'step_3'
    })
    expect(entry.action).toBe('serial_completed')
    expect(entry.fromStepId).toBe('step_3')
  })

  it('recordNoteCreation creates entry with correct action', () => {
    const entry = service.recordNoteCreation({
      userId: 'user_1',
      jobId: 'job_1',
      pathId: 'path_1',
      stepId: 'step_1',
      serialId: 'sn_1'
    })
    expect(entry.action).toBe('note_created')
    expect(entry.stepId).toBe('step_1')
  })

  it('getSerialAuditTrail delegates to repo', () => {
    service.recordCertAttachment({ userId: 'u', serialId: 'sn_1', certId: 'c', stepId: 's' })
    service.recordSerialAdvancement({ userId: 'u', serialId: 'sn_1', fromStepId: 's1', toStepId: 's2' })
    const trail = service.getSerialAuditTrail('sn_1')
    expect(trail).toHaveLength(2)
  })

  it('getJobAuditTrail delegates to repo', () => {
    service.recordSerialCreation({ userId: 'u', jobId: 'job_1', pathId: 'p', batchQuantity: 5 })
    const trail = service.getJobAuditTrail('job_1')
    expect(trail).toHaveLength(1)
  })

  it('listAuditEntries supports pagination', () => {
    for (let i = 0; i < 5; i++) {
      service.recordSerialCreation({ userId: 'u', jobId: 'j', pathId: 'p', batchQuantity: 1 })
    }
    const page = service.listAuditEntries({ limit: 2, offset: 1 })
    expect(page).toHaveLength(2)
  })

  it('each entry gets a unique ID', () => {
    const e1 = service.recordSerialCreation({ userId: 'u', jobId: 'j', pathId: 'p', batchQuantity: 1 })
    const e2 = service.recordSerialCreation({ userId: 'u', jobId: 'j', pathId: 'p', batchQuantity: 1 })
    expect(e1.id).not.toBe(e2.id)
  })
})
