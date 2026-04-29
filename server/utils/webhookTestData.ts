/**
 * Test payload generators for webhook events.
 *
 * Used by the POST /api/webhooks/events/test endpoint to generate
 * realistic sample data for each event type. Extracted here so the
 * route handler stays thin and the generators are reusable.
 */
import type { WebhookEventType } from '../types/domain'

export function buildTestPayload(eventType: WebhookEventType): Record<string, unknown> {
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
      }
    case 'part_completed':
      return {
        user: 'Test User',
        partId: 'SN-00042',
        targetStepId: 'step_final',
        newStatus: 'completed',
      }
    case 'part_created':
      return {
        user: 'Test User',
        partId: 'SN-00099',
        jobId: 'job_sample1',
        jobName: 'Test Job Alpha',
        pathId: 'path_sample1',
        pathName: 'Main Route',
      }
    case 'part_scrapped':
      return {
        user: 'Test User',
        partId: 'SN-00042',
        reason: 'dimensional_failure',
        explanation: 'OD out of tolerance by 0.005"',
      }
    case 'part_force_completed':
      return {
        user: 'Test User',
        partId: 'SN-00042',
        reason: 'Customer accepted as-is',
      }
    case 'step_skipped':
      return {
        user: 'Test User',
        partId: 'SN-00042',
        stepId: 'step_abc123',
        stepName: 'Deburring',
        reason: 'Optional step not required for this order',
      }
    case 'step_deferred':
      return {
        user: 'Test User',
        partId: 'SN-00042',
        stepId: 'step_abc123',
        stepName: 'Final Inspection',
      }
    case 'step_waived':
      return {
        user: 'Test User',
        partId: 'SN-00042',
        stepId: 'step_abc123',
        stepName: 'Final Inspection',
        reason: 'Waived per engineering approval ECN-2024-031',
      }
    case 'job_created':
      return {
        user: 'Test User',
        jobId: 'job_sample1',
        jobName: 'Test Job Alpha',
        goalQuantity: 50,
      }
    case 'job_deleted':
      return {
        user: 'Test User',
        jobId: 'job_sample1',
        jobName: 'Test Job Alpha',
      }
    case 'path_deleted':
      return {
        user: 'Test User',
        pathId: 'path_sample1',
        pathName: 'Secondary Route',
        jobId: 'job_sample1',
        deletedPartIds: ['SN-00010', 'SN-00011'],
      }
    case 'note_created':
      return {
        user: 'Test User',
        noteId: 'note_sample1',
        stepId: 'step_abc123',
        stepName: 'Machining',
        partIds: ['SN-00042', 'SN-00043'],
        text: 'Surface finish below spec on these parts',
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
      }
    default: {
      const _exhaustive: never = eventType
      throw new Error(`Unhandled event type: ${_exhaustive}`)
    }
  }
}

export function buildTestSummary(eventType: WebhookEventType, data: Record<string, unknown>): string {
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
    default: {
      const _exhaustive: never = eventType
      throw new Error(`Unhandled event type: ${_exhaustive}`)
    }
  }
}
