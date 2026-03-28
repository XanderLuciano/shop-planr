import { describe, it, expect } from 'vitest'
import { ValidationError } from '../../../server/utils/errors'
import { serialize, deserialize, prettyPrint } from '../../../server/utils/serialization'

const sampleJob = {
  id: 'job_abc123',
  name: 'Launch Lock Body',
  goalQuantity: 20,
  pathIds: ['path_1', 'path_2'],
  createdAt: '2025-01-15T00:00:00.000Z',
  updatedAt: '2025-01-15T00:00:00.000Z'
}

const sampleCert = {
  id: 'cert_xyz',
  type: 'material' as const,
  name: '6061-T6 Mill Cert',
  metadata: { vendor: 'Alcoa', lot: 'A123' },
  createdAt: '2025-01-15T00:00:00.000Z'
}

describe('serialize / deserialize round-trip', () => {
  it('should round-trip a Job', () => {
    const json = serialize(sampleJob)
    const result = deserialize(json, 'Job')
    expect(result).toEqual(sampleJob)
  })

  it('should round-trip a Job via prettyPrint', () => {
    const json = prettyPrint(sampleJob)
    expect(json).toContain('\n') // indented
    const result = deserialize(json, 'Job')
    expect(result).toEqual(sampleJob)
  })

  it('should round-trip a Certificate', () => {
    const json = serialize(sampleCert)
    const result = deserialize(json, 'Certificate')
    expect(result).toEqual(sampleCert)
  })

  it('should round-trip a ProcessStep', () => {
    const step = { id: 'step_1', name: 'OP1', order: 0, location: 'Machine Shop' }
    const result = deserialize(serialize(step), 'ProcessStep')
    expect(result).toEqual(step)
  })

  it('should round-trip a Part', () => {
    const part = {
      id: 'part_00001',
      jobId: 'job_1',
      pathId: 'path_1',
      currentStepIndex: 2,
      certIds: [],
      createdAt: '2025-01-15T00:00:00.000Z',
      updatedAt: '2025-01-15T00:00:00.000Z'
    }
    const result = deserialize(serialize(part), 'Part')
    expect(result).toEqual(part)
  })

  it('should round-trip a ShopUser', () => {
    const user = {
      id: 'user_1',
      name: 'Mike Jones',
      department: 'Machining',
      active: true,
      createdAt: '2025-01-15T00:00:00.000Z'
    }
    const result = deserialize(serialize(user), 'ShopUser')
    expect(result).toEqual(user)
  })

  it('should round-trip an AuditEntry', () => {
    const entry = {
      id: 'aud_1',
      action: 'part_created',
      userId: 'user_1',
      timestamp: '2025-01-15T00:00:00.000Z',
      jobId: 'job_1',
      pathId: 'path_1',
      batchQuantity: 10
    }
    const result = deserialize(serialize(entry), 'AuditEntry')
    expect(result).toEqual(entry)
  })
})

describe('deserialize error handling', () => {
  it('should throw for invalid JSON', () => {
    expect(() => deserialize('not json', 'Job')).toThrow(ValidationError)
    expect(() => deserialize('not json', 'Job')).toThrow('invalid JSON')
  })

  it('should throw for non-object JSON', () => {
    expect(() => deserialize('"just a string"', 'Job')).toThrow('expected an object')
    expect(() => deserialize('[1,2,3]', 'Job')).toThrow('expected an object')
  })

  it('should throw for missing required string field', () => {
    const bad = { ...sampleJob, name: undefined }
    delete (bad as Record<string, unknown>).name
    expect(() => deserialize(JSON.stringify(bad), 'Job')).toThrow('Job.name')
  })

  it('should throw for wrong type on required number field', () => {
    const bad = { ...sampleJob, goalQuantity: 'not a number' }
    expect(() => deserialize(JSON.stringify(bad), 'Job')).toThrow('Job.goalQuantity')
  })

  it('should throw for invalid cert type', () => {
    const bad = { ...sampleCert, type: 'invalid' }
    expect(() => deserialize(JSON.stringify(bad), 'Certificate')).toThrow('must be "material" or "process"')
  })

  it('should throw for unknown domain type', () => {
    expect(() => deserialize('{}', 'UnknownType' as any)).toThrow('unknown type')
  })
})
