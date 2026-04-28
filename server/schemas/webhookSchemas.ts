import { z } from 'zod'
import { requiredId } from './_primitives'
import { WEBHOOK_EVENT_TYPES } from '../types/domain'

const webhookEventTypeEnum = z.enum(WEBHOOK_EVENT_TYPES)

export const queueEventSchema = z.object({
  eventType: webhookEventTypeEnum,
  payload: z.record(z.string(), z.unknown()),
  summary: z.string().min(1, 'summary is required'),
})

export const updateConfigSchema = z.object({
  endpointUrl: z.string().optional(),
  enabledEventTypes: z.array(webhookEventTypeEnum).optional(),
  isActive: z.boolean().optional(),
})

export const updateEventStatusSchema = z.object({
  status: z.enum(['sent', 'failed', 'queued']),
  error: z.string().optional(),
})

export const batchUpdateStatusSchema = z.object({
  events: z.array(z.object({
    id: requiredId,
    status: z.enum(['sent', 'failed']),
    error: z.string().optional(),
  })),
})
