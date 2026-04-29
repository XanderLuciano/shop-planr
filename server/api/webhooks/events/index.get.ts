import { listEventsQuerySchema } from '../../../schemas/webhookSchemas'
import type { EventWithDeliveries } from '../../../types/domain'

defineRouteMeta({
  openAPI: {
    tags: ['Webhooks'],
    description: 'List webhook events with delivery summaries and optional pagination (limit, offset query params).',
    responses: {
      200: { description: 'Array of webhook events with delivery summaries' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const { limit, offset } = parseQuery(event, listEventsQuerySchema)
  const events = getServices().webhookService.listEvents({ limit, offset })

  if (events.length === 0) return []

  const eventIds = events.map(e => e.id)
  const summaries = getRepositories().webhookDeliveries.getDeliverySummariesByEventIds(eventIds)

  const result: EventWithDeliveries[] = events.map((e) => {
    const counts = summaries.get(e.id) ?? { queued: 0, delivering: 0, delivered: 0, failed: 0, canceled: 0 }
    return {
      id: e.id,
      eventType: e.eventType,
      payload: e.payload,
      summary: e.summary,
      createdAt: e.createdAt,
      deliverySummary: {
        total: counts.queued + counts.delivering + counts.delivered + counts.failed + counts.canceled,
        ...counts,
      },
    }
  })

  return result
})
