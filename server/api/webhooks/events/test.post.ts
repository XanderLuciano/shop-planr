import { z } from 'zod'
import { WEBHOOK_EVENT_TYPES } from '../../../types/domain'

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
  const userId = getAuthUserId(event)
  requireAdmin(getRepositories().users, userId, 'send test webhook events')
  const body = await parseBody(event, testEventSchema)
  const payload = buildTestPayload(body.eventType)
  const summary = `[TEST] ${buildTestSummary(body.eventType, payload)}`

  return getServices().webhookService.queueEvent({
    eventType: body.eventType,
    payload,
    summary,
  })
})
