/**
 * Unit tests for server/utils/webhookTestData.ts
 *
 * Validates that buildTestPayload produces payloads conforming to the
 * Zod schemas in webhookPayloadSchemas.ts for every event type, and
 * that buildTestSummary produces non-empty strings.
 */
import { describe, it, expect } from 'vitest'
import { buildTestPayload, buildTestSummary } from '~/server/utils/webhookTestData'
import { WEBHOOK_PAYLOAD_SCHEMAS } from '~/server/schemas/webhookPayloadSchemas'
import { WEBHOOK_EVENT_TYPES } from '~/server/types/domain'

describe('buildTestPayload', () => {
  it('produces a valid payload for every event type', () => {
    for (const eventType of WEBHOOK_EVENT_TYPES) {
      const payload = buildTestPayload(eventType)
      const schema = WEBHOOK_PAYLOAD_SCHEMAS[eventType]
      const result = schema.safeParse(payload)

      if (!result.success) {
        // Provide a helpful error message
        const errors = result.error.flatten().fieldErrors
        throw new Error(
          `buildTestPayload('${eventType}') failed schema validation:\n${JSON.stringify(errors, null, 2)}`,
        )
      }

      expect(result.success).toBe(true)
    }
  })

  it('always includes a user field', () => {
    for (const eventType of WEBHOOK_EVENT_TYPES) {
      const payload = buildTestPayload(eventType)
      expect(payload.user).toBe('Test User')
    }
  })

  it('part_advanced includes expected fields', () => {
    const payload = buildTestPayload('part_advanced')
    expect(payload.partId).toBeDefined()
    expect(payload.targetStepId).toBeDefined()
    expect(typeof payload.skip).toBe('boolean')
    expect(payload.newStatus).toBeDefined()
  })

  it('part_created includes count matching partIds length', () => {
    const payload = buildTestPayload('part_created')
    expect(payload.count).toBe((payload.partIds as string[]).length)
  })

  it('cert_attached includes cert metadata', () => {
    const payload = buildTestPayload('cert_attached')
    expect(payload.certId).toBeDefined()
    expect(payload.certName).toBeDefined()
    expect(payload.certType).toBeDefined()
    expect(['material', 'process']).toContain(payload.certType)
  })

  it('job_created includes goalQuantity', () => {
    const payload = buildTestPayload('job_created')
    expect(typeof payload.goalQuantity).toBe('number')
    expect(payload.goalQuantity).toBeGreaterThan(0)
  })

  it('path_deleted includes deletedPartIds array', () => {
    const payload = buildTestPayload('path_deleted')
    expect(Array.isArray(payload.deletedPartIds)).toBe(true)
    expect((payload.deletedPartIds as string[]).length).toBeGreaterThan(0)
  })

  it('note_created includes text content', () => {
    const payload = buildTestPayload('note_created')
    expect(typeof payload.text).toBe('string')
    expect((payload.text as string).length).toBeGreaterThan(0)
  })
})

describe('buildTestSummary', () => {
  it('produces a non-empty string for every event type', () => {
    for (const eventType of WEBHOOK_EVENT_TYPES) {
      const payload = buildTestPayload(eventType)
      const summary = buildTestSummary(eventType, payload)
      expect(typeof summary).toBe('string')
      expect(summary.length).toBeGreaterThan(0)
    }
  })

  it('part_advanced summary includes partId', () => {
    const payload = buildTestPayload('part_advanced')
    const summary = buildTestSummary('part_advanced', payload)
    expect(summary).toContain(payload.partId as string)
  })

  it('job_created summary includes job name', () => {
    const payload = buildTestPayload('job_created')
    const summary = buildTestSummary('job_created', payload)
    expect(summary).toContain(payload.jobName as string)
  })

  it('part_created summary includes count', () => {
    const payload = buildTestPayload('part_created')
    const summary = buildTestSummary('part_created', payload)
    expect(summary).toContain(String((payload.partIds as string[]).length))
  })

  it('cert_attached summary includes cert name', () => {
    const payload = buildTestPayload('cert_attached')
    const summary = buildTestSummary('cert_attached', payload)
    expect(summary).toContain(payload.certName as string)
  })

  it('note_created summary includes step name', () => {
    const payload = buildTestPayload('note_created')
    const summary = buildTestSummary('note_created', payload)
    expect(summary).toContain(payload.stepName as string)
  })

  it('step_waived summary includes step name', () => {
    const payload = buildTestPayload('step_waived')
    const summary = buildTestSummary('step_waived', payload)
    expect(summary).toContain(payload.stepName as string)
  })
})
