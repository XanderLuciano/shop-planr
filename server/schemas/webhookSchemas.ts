import { z } from 'zod'
import { WEBHOOK_EVENT_TYPES } from '../types/domain'

const webhookEventTypeEnum = z.enum(WEBHOOK_EVENT_TYPES)

export const queueEventSchema = z.object({
  eventType: webhookEventTypeEnum,
  payload: z.record(z.string(), z.unknown()),
  summary: z.string().min(1, 'summary is required'),
})

export const listEventsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).default(200),
  offset: z.coerce.number().int().min(0).default(0),
})
