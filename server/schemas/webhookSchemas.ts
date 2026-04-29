/**
 * Zod schemas for all webhook API endpoints: events, registrations, and deliveries.
 */
import { z } from 'zod'
import { requiredId } from './_primitives'
import { WEBHOOK_EVENT_TYPES, WEBHOOK_DELIVERY_STATUSES } from '../types/domain'

// ---- Event schemas ----

export const queueEventSchema = z.object({
  eventType: z.enum(WEBHOOK_EVENT_TYPES),
  payload: z.record(z.string(), z.unknown()),
  summary: z.string().min(1, 'summary is required'),
})

export const listEventsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).default(200),
  offset: z.coerce.number().int().min(0).default(0),
})

// ---- Registration schemas ----

const httpUrl = z.string().min(1, 'URL is required').url('Must be a valid URL').refine(u => /^https?:\/\//.test(u), 'URL must use http or https')

export const createRegistrationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  url: httpUrl,
  eventTypes: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1, 'At least one event type is required'),
})

export const updateRegistrationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: httpUrl.optional(),
  eventTypes: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1).optional(),
})

// ---- Delivery schemas ----

export const batchDeliveryStatusSchema = z.object({
  deliveries: z.array(z.object({
    id: requiredId,
    status: z.enum(WEBHOOK_DELIVERY_STATUSES),
    error: z.string().optional(),
  })).min(1),
})

export const updateDeliveryStatusSchema = z.object({
  status: z.enum(WEBHOOK_DELIVERY_STATUSES),
  error: z.string().optional(),
})

export const listQueuedQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional(),
})
