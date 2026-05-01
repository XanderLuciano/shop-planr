/**
 * Unit tests for webhook Zod schemas.
 *
 * Covers: queueEventSchema, createRegistrationSchema, updateRegistrationSchema,
 * batchDeliveryStatusSchema, updateDeliveryStatusSchema, listEventsQuerySchema,
 * listQueuedQuerySchema validation rules.
 */
import { describe, it, expect } from 'vitest'
import {
  queueEventSchema,
  createRegistrationSchema,
  updateRegistrationSchema,
  batchDeliveryStatusSchema,
  updateDeliveryStatusSchema,
  listEventsQuerySchema,
  listQueuedQuerySchema,
} from '~/server/schemas/webhookSchemas'

describe('queueEventSchema', () => {
  it('accepts valid input', () => {
    const result = queueEventSchema.safeParse({
      eventType: 'part_advanced',
      payload: { partId: 'p1', user: 'Alice' },
      summary: 'Part advanced to step 2',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid event type', () => {
    const result = queueEventSchema.safeParse({
      eventType: 'invalid_type',
      payload: {},
      summary: 'test',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty summary', () => {
    const result = queueEventSchema.safeParse({
      eventType: 'part_advanced',
      payload: {},
      summary: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing payload', () => {
    const result = queueEventSchema.safeParse({
      eventType: 'part_advanced',
      summary: 'test',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid event types', () => {
    const types = [
      'part_advanced', 'part_completed', 'part_created', 'part_scrapped',
      'part_force_completed', 'part_deleted', 'step_skipped', 'step_deferred',
      'step_waived', 'deferred_step_completed', 'step_override_created',
      'step_override_reversed', 'job_created', 'job_deleted', 'path_deleted',
      'note_created', 'cert_attached',
    ]
    for (const eventType of types) {
      const result = queueEventSchema.safeParse({
        eventType,
        payload: {},
        summary: 'test',
      })
      expect(result.success).toBe(true)
    }
  })

  it('accepts payload with arbitrary keys', () => {
    const result = queueEventSchema.safeParse({
      eventType: 'job_created',
      payload: { jobId: 'j1', jobName: 'Test', goalQuantity: 50, nested: { a: 1 } },
      summary: 'Job created',
    })
    expect(result.success).toBe(true)
  })
})

describe('createRegistrationSchema', () => {
  it('accepts valid input', () => {
    const result = createRegistrationSchema.safeParse({
      name: 'Slack Notifications',
      url: 'https://hooks.slack.com/services/xxx',
      eventTypes: ['part_advanced', 'job_created'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = createRegistrationSchema.safeParse({
      name: '',
      url: 'https://example.com/hook',
      eventTypes: ['part_advanced'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects name longer than 100 chars', () => {
    const result = createRegistrationSchema.safeParse({
      name: 'x'.repeat(101),
      url: 'https://example.com/hook',
      eventTypes: ['part_advanced'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-http URL', () => {
    const result = createRegistrationSchema.safeParse({
      name: 'Test',
      url: 'ftp://example.com/hook',
      eventTypes: ['part_advanced'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty URL', () => {
    const result = createRegistrationSchema.safeParse({
      name: 'Test',
      url: '',
      eventTypes: ['part_advanced'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty eventTypes array', () => {
    const result = createRegistrationSchema.safeParse({
      name: 'Test',
      url: 'https://example.com/hook',
      eventTypes: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid event type in array', () => {
    const result = createRegistrationSchema.safeParse({
      name: 'Test',
      url: 'https://example.com/hook',
      eventTypes: ['part_advanced', 'not_a_real_type'],
    })
    expect(result.success).toBe(false)
  })

  it('accepts http URL', () => {
    const result = createRegistrationSchema.safeParse({
      name: 'Local Dev',
      url: 'http://localhost:3000/webhook',
      eventTypes: ['job_created'],
    })
    expect(result.success).toBe(true)
  })
})

describe('updateRegistrationSchema', () => {
  it('accepts empty object (no updates)', () => {
    const result = updateRegistrationSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts partial name update', () => {
    const result = updateRegistrationSchema.safeParse({ name: 'New Name' })
    expect(result.success).toBe(true)
  })

  it('accepts partial url update', () => {
    const result = updateRegistrationSchema.safeParse({ url: 'https://new.example.com/hook' })
    expect(result.success).toBe(true)
  })

  it('accepts partial eventTypes update', () => {
    const result = updateRegistrationSchema.safeParse({
      eventTypes: ['job_created', 'job_deleted'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = updateRegistrationSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid URL', () => {
    const result = updateRegistrationSchema.safeParse({ url: 'not-a-url' })
    expect(result.success).toBe(false)
  })

  it('rejects empty eventTypes array', () => {
    const result = updateRegistrationSchema.safeParse({ eventTypes: [] })
    expect(result.success).toBe(false)
  })
})

describe('batchDeliveryStatusSchema', () => {
  it('accepts valid batch update', () => {
    const result = batchDeliveryStatusSchema.safeParse({
      deliveries: [
        { id: 'whd_1', status: 'delivering' },
        { id: 'whd_2', status: 'delivered' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts delivery with error message', () => {
    const result = batchDeliveryStatusSchema.safeParse({
      deliveries: [
        { id: 'whd_1', status: 'failed', error: 'Connection refused' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty deliveries array', () => {
    const result = batchDeliveryStatusSchema.safeParse({ deliveries: [] })
    expect(result.success).toBe(false)
  })

  it('rejects delivery with empty id', () => {
    const result = batchDeliveryStatusSchema.safeParse({
      deliveries: [{ id: '', status: 'delivering' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid status', () => {
    const result = batchDeliveryStatusSchema.safeParse({
      deliveries: [{ id: 'whd_1', status: 'invalid_status' }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid delivery statuses', () => {
    const statuses = ['queued', 'delivering', 'delivered', 'failed', 'canceled']
    for (const status of statuses) {
      const result = batchDeliveryStatusSchema.safeParse({
        deliveries: [{ id: 'whd_1', status }],
      })
      expect(result.success).toBe(true)
    }
  })
})

describe('updateDeliveryStatusSchema', () => {
  it('accepts valid status', () => {
    const result = updateDeliveryStatusSchema.safeParse({ status: 'delivering' })
    expect(result.success).toBe(true)
  })

  it('accepts status with error', () => {
    const result = updateDeliveryStatusSchema.safeParse({
      status: 'failed',
      error: 'Timeout after 30s',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const result = updateDeliveryStatusSchema.safeParse({ status: 'bogus' })
    expect(result.success).toBe(false)
  })

  it('rejects missing status', () => {
    const result = updateDeliveryStatusSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('listEventsQuerySchema', () => {
  it('defaults limit to 200 and offset to 0', () => {
    const result = listEventsQuerySchema.parse({})
    expect(result.limit).toBe(200)
    expect(result.offset).toBe(0)
  })

  it('accepts custom limit and offset', () => {
    const result = listEventsQuerySchema.parse({ limit: '50', offset: '10' })
    expect(result.limit).toBe(50)
    expect(result.offset).toBe(10)
  })

  it('coerces string numbers', () => {
    const result = listEventsQuerySchema.parse({ limit: '100', offset: '25' })
    expect(result.limit).toBe(100)
    expect(result.offset).toBe(25)
  })

  it('rejects limit > 1000', () => {
    const result = listEventsQuerySchema.safeParse({ limit: '1001' })
    expect(result.success).toBe(false)
  })

  it('rejects negative offset', () => {
    const result = listEventsQuerySchema.safeParse({ offset: '-1' })
    expect(result.success).toBe(false)
  })

  it('rejects limit of 0', () => {
    const result = listEventsQuerySchema.safeParse({ limit: '0' })
    expect(result.success).toBe(false)
  })
})

describe('listQueuedQuerySchema', () => {
  it('accepts no limit (optional)', () => {
    const result = listQueuedQuerySchema.parse({})
    expect(result.limit).toBeUndefined()
  })

  it('accepts valid limit', () => {
    const result = listQueuedQuerySchema.parse({ limit: '50' })
    expect(result.limit).toBe(50)
  })

  it('rejects limit > 1000', () => {
    const result = listQueuedQuerySchema.safeParse({ limit: '1001' })
    expect(result.success).toBe(false)
  })

  it('rejects limit of 0', () => {
    const result = listQueuedQuerySchema.safeParse({ limit: '0' })
    expect(result.success).toBe(false)
  })
})
