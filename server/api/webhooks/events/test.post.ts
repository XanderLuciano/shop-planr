import { z } from 'zod'
import { WEBHOOK_EVENT_TYPES } from '../../../types/domain'
import type { WebhookEventType } from '../../../types/domain'

const testEventSchema = z.object({
  eventType: z.enum(WEBHOOK_EVENT_TYPES),
})

defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'Queue a test webhook event with realistic sample data. Useful for verifying endpoint integration.',
    requestBody: zodRequestBody(testEventSchema),
    responses: {
      200: { description: 'Queued test webhook event' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await parseBody(event, testEventSchema)
  const payload = buildTestPayload(body.eventType)
  const summary = `[TEST] ${buildTestSummary(body.eventType, payload)}`

  return getServices().webhookService.queueEvent({
    eventType: body.eventType,
    payload,
    summary,
  })
})

function buildTestPayload(eventType: WebhookEventType): Record<string, unknown> {
  const now = new Date().toISOString()

  switch (eventType) {
    case 'part_advanced':
      return {
        user: 'Test User',
        partId: 'SN-00042',
        targetStepId: 'step_abc123',
        fromStep: 'Machining',
        toStep: 'Inspection',
        skip: false,
        newStatus: 'in_progress',
        time: now,
      }
    case 'part_completed':
      return {
        user: 'Test User',
        partId: 'SN-00042',
        targetStepId: 'step_final',
        newStatus: 'completed',
        time: now,
      }
    case 'part_created':
      return {
        user: 'Test User',
        partId: 'SN-00099',
        jobId: 'job_sample1',
        jobName: 'Test Job Alpha',
        pathId: 'path_sample1',
        pathName: 'Main Route',
        time: now,
      }
    case 'part_scrapped':
      return {
        user: 'Test User',
        partId: 'SN-00042',
        reason: 'dimensional_failure',
        explanation: 'OD out of tolerance by 0.005"',
        time: now,
      }
    case 'part_force_completed':
      return {
        user: 'Test User',
        partId: 'SN-00042',
        reason: 'Customer accepted as-is',
        time: now,
      }
    case 'step_skipped':
      return {
        user: 'Test User',
        partId: 'SN-00042',
        stepId: 'step_abc123',
        stepName: 'Deburring',
        reason: 'Optional step not required for this order',
        time: now,
      }
    case 'step_deferred':
      return {
        user: 'Test User',
        partId: 'SN-00042',
        stepId: 'step_abc123',
        stepName: 'Final Inspection',
        time: now,
      }
    case 'step_waived':
      return {
        user: 'Test User',
        partId: 'SN-00042',
        stepId: 'step_abc123',
        stepName: 'Final Inspection',
        reason: 'Waived per engineering approval ECN-2024-031',
        time: now,
      }
    case 'job_created':
      return {
        user: 'Test User',
        jobId: 'job_sample1',
        jobName: 'Test Job Alpha',
        goalQuantity: 50,
        time: now,
      }
    case 'job_deleted':
      return {
        user: 'Test User',
        jobId: 'job_sample1',
        jobName: 'Test Job Alpha',
        time: now,
      }
    case 'path_deleted':
      return {
        user: 'Test User',
        pathId: 'path_sample1',
        pathName: 'Secondary Route',
        jobId: 'job_sample1',
        deletedPartIds: ['SN-00010', 'SN-00011'],
        time: now,
      }
    case 'note_created':
      return {
        user: 'Test User',
        noteId: 'note_sample1',
        stepId: 'step_abc123',
        stepName: 'Machining',
        partIds: ['SN-00042', 'SN-00043'],
        text: 'Surface finish below spec on these parts',
        time: now,
      }
    case 'cert_attached':
      return {
        user: 'Test User',
        certId: 'cert_sample1',
        certName: 'Material Test Report',
        certType: 'material',
        partId: 'SN-00042',
        stepId: 'step_abc123',
        stepName: 'Receiving',
        time: now,
      }
  }
}

function buildTestSummary(eventType: WebhookEventType, data: Record<string, unknown>): string {
  switch (eventType) {
    case 'part_advanced':
      return `${data.partId} advanced: ${data.fromStep} → ${data.toStep}`
    case 'part_completed':
      return `${data.partId} completed all steps`
    case 'part_created':
      return `${data.partId} created in ${data.jobName}`
    case 'part_scrapped':
      return `${data.partId} scrapped: ${data.reason}`
    case 'part_force_completed':
      return `${data.partId} force-completed`
    case 'step_skipped':
      return `${data.partId} skipped ${data.stepName}`
    case 'step_deferred':
      return `${data.partId} deferred ${data.stepName}`
    case 'step_waived':
      return `${data.partId} waived ${data.stepName}`
    case 'job_created':
      return `Job "${data.jobName}" created (qty: ${data.goalQuantity})`
    case 'job_deleted':
      return `Job "${data.jobName}" deleted`
    case 'path_deleted':
      return `Path "${data.pathName}" deleted from job`
    case 'note_created':
      return `Note on ${data.stepName}: "${String(data.text).slice(0, 50)}"`
    case 'cert_attached':
      return `${data.certName} attached to ${data.partId} at ${data.stepName}`
  }
}
