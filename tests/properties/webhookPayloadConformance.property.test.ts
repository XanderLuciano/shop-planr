/**
 * Property tests for webhook payload schema conformance.
 *
 * Validates that buildTestPayload output conforms to the Zod schemas
 * for every event type, and that the formatWebhookEventType function
 * is idempotent and produces consistent output.
 *
 * - Property 1: buildTestPayload conforms to schema for every event type
 * - Property 2: formatWebhookEventType is deterministic
 * - Property 3: buildSummary produces non-empty strings for any valid payload
 * - Property 4: Payload schemas accept the documented field types
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { WEBHOOK_EVENT_TYPES } from '~/server/types/domain'
import type { WebhookEventType } from '~/server/types/domain'
import { WEBHOOK_PAYLOAD_SCHEMAS } from '~/server/schemas/webhookPayloadSchemas'
import { buildTestPayload, buildTestSummary } from '~/server/utils/webhookTestData'
import { formatWebhookEventType } from '~/server/utils/webhookEmit'

// ---- Arbitraries ----

const arbEventType: fc.Arbitrary<WebhookEventType> = fc.constantFrom(...WEBHOOK_EVENT_TYPES)

const arbSnakeCase = fc.stringMatching(/^[a-z][a-z_]{2,30}$/)

// ---- Property 1 ----

describe('Property 1: buildTestPayload conforms to schema for every event type', () => {
  it('every event type produces a schema-valid payload', () => {
    fc.assert(
      fc.property(arbEventType, (eventType) => {
        const payload = buildTestPayload(eventType)
        const schema = WEBHOOK_PAYLOAD_SCHEMAS[eventType]
        const result = schema.safeParse(payload)
        expect(result.success).toBe(true)
      }),
      { numRuns: WEBHOOK_EVENT_TYPES.length * 3 },
    )
  })
})

// ---- Property 2 ----

describe('Property 2: formatWebhookEventType is deterministic', () => {
  it('same input always produces same output', () => {
    fc.assert(
      fc.property(arbSnakeCase, (input) => {
        const a = formatWebhookEventType(input)
        const b = formatWebhookEventType(input)
        expect(a).toBe(b)
      }),
      { numRuns: 100 },
    )
  })

  it('output words are capitalized', () => {
    fc.assert(
      fc.property(arbSnakeCase, (input) => {
        const result = formatWebhookEventType(input)
        const words = result.split(' ')
        for (const word of words) {
          if (word.length > 0) {
            expect(word[0]).toBe(word[0].toUpperCase())
          }
        }
      }),
      { numRuns: 100 },
    )
  })

  it('output has no underscores', () => {
    fc.assert(
      fc.property(arbSnakeCase, (input) => {
        const result = formatWebhookEventType(input)
        expect(result).not.toContain('_')
      }),
      { numRuns: 100 },
    )
  })

  it('word count equals underscore count + 1', () => {
    fc.assert(
      fc.property(arbSnakeCase, (input) => {
        const result = formatWebhookEventType(input)
        const underscoreCount = (input.match(/_/g) || []).length
        const wordCount = result.split(' ').length
        expect(wordCount).toBe(underscoreCount + 1)
      }),
      { numRuns: 100 },
    )
  })
})

// ---- Property 3 ----

describe('Property 3: buildTestSummary produces non-empty strings', () => {
  it('summary is always a non-empty string for every event type', () => {
    fc.assert(
      fc.property(arbEventType, (eventType) => {
        const payload = buildTestPayload(eventType)
        const summary = buildTestSummary(eventType, payload)
        expect(typeof summary).toBe('string')
        expect(summary.length).toBeGreaterThan(0)
      }),
      { numRuns: WEBHOOK_EVENT_TYPES.length * 3 },
    )
  })
})

// ---- Property 4 ----

describe('Property 4: Payload schemas accept documented field types', () => {
  it('part_advanced accepts both single-part and batch payloads', () => {
    const singlePart = {
      user: 'Alice',
      partId: 'SN-001',
      newStatus: 'in_progress',
    }
    const batch = {
      user: 'Alice',
      partIds: ['SN-001', 'SN-002'],
      advancedCount: 2,
      failedCount: 0,
    }

    expect(WEBHOOK_PAYLOAD_SCHEMAS.part_advanced.safeParse(singlePart).success).toBe(true)
    expect(WEBHOOK_PAYLOAD_SCHEMAS.part_advanced.safeParse(batch).success).toBe(true)
  })

  it('part_completed accepts both single-part and batch payloads', () => {
    const singlePart = {
      user: 'Bob',
      partId: 'SN-001',
      newStatus: 'completed',
    }
    const batch = {
      user: 'Bob',
      partIds: ['SN-001', 'SN-002'],
      count: 2,
    }

    expect(WEBHOOK_PAYLOAD_SCHEMAS.part_completed.safeParse(singlePart).success).toBe(true)
    expect(WEBHOOK_PAYLOAD_SCHEMAS.part_completed.safeParse(batch).success).toBe(true)
  })

  it('step_skipped requires stepId and stepName', () => {
    const valid = {
      user: 'Alice',
      partId: 'SN-001',
      stepId: 'step_1',
      stepName: 'Deburring',
    }
    const missingStepId = {
      user: 'Alice',
      partId: 'SN-001',
      stepName: 'Deburring',
    }
    const missingStepName = {
      user: 'Alice',
      partId: 'SN-001',
      stepId: 'step_1',
    }

    expect(WEBHOOK_PAYLOAD_SCHEMAS.step_skipped.safeParse(valid).success).toBe(true)
    expect(WEBHOOK_PAYLOAD_SCHEMAS.step_skipped.safeParse(missingStepId).success).toBe(false)
    expect(WEBHOOK_PAYLOAD_SCHEMAS.step_skipped.safeParse(missingStepName).success).toBe(false)
  })

  it('job_created requires all fields', () => {
    const valid = {
      user: 'Alice',
      jobId: 'job_1',
      jobName: 'Test Job',
      goalQuantity: 50,
    }
    const missingJobId = {
      user: 'Alice',
      jobName: 'Test Job',
      goalQuantity: 50,
    }

    expect(WEBHOOK_PAYLOAD_SCHEMAS.job_created.safeParse(valid).success).toBe(true)
    expect(WEBHOOK_PAYLOAD_SCHEMAS.job_created.safeParse(missingJobId).success).toBe(false)
  })

  it('cert_attached requires certId, certName, certType, and stepId', () => {
    const valid = {
      user: 'Alice',
      certId: 'cert_1',
      certName: 'Material Report',
      certType: 'material',
      stepId: 'step_1',
      partIds: ['SN-001'],
      count: 1,
    }
    const missingCertId = { ...valid, certId: undefined }

    expect(WEBHOOK_PAYLOAD_SCHEMAS.cert_attached.safeParse(valid).success).toBe(true)
    expect(WEBHOOK_PAYLOAD_SCHEMAS.cert_attached.safeParse(missingCertId).success).toBe(false)
  })

  it('all schemas require user field', () => {
    fc.assert(
      fc.property(arbEventType, (eventType) => {
        const schema = WEBHOOK_PAYLOAD_SCHEMAS[eventType]
        // Empty object should fail (missing user at minimum)
        const result = schema.safeParse({})
        expect(result.success).toBe(false)
      }),
      { numRuns: WEBHOOK_EVENT_TYPES.length },
    )
  })
})
