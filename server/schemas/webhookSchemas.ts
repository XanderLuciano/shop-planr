/**
 * Zod schemas for all webhook API endpoints: events, registrations, and deliveries.
 *
 * Follows the project convention of colocating schemas by domain.
 * Shared primitives (requiredId, etc.) come from `_primitives.ts`.
 * Domain enums (WEBHOOK_EVENT_TYPES, WEBHOOK_DELIVERY_STATUSES) are
 * derived from `as const` arrays in `server/types/domain.ts`.
 */
import { z } from 'zod'
import { requiredId } from './_primitives'
import { WEBHOOK_EVENT_TYPES, WEBHOOK_DELIVERY_STATUSES } from '../types/domain'

// ---- Shared field schemas ----

/** Webhook event type enum — derived from domain.ts const array. */
const webhookEventTypeEnum = z.enum(WEBHOOK_EVENT_TYPES).describe('Webhook event type identifier (e.g. part_advanced, job_created)')

/** Webhook delivery status enum — derived from domain.ts const array. */
const webhookDeliveryStatusEnum = z.enum(WEBHOOK_DELIVERY_STATUSES).describe('Delivery lifecycle status')

/** HTTP(S) URL with protocol enforcement. */
const httpUrl = z.string()
  .min(1, 'URL is required')
  .refine(u => /^https?:\/\/.+/.test(u), 'Must be a valid http or https URL')
  .describe('Webhook endpoint URL (must use http or https)')

// ---- Event schemas ----

/** Queue a new webhook event for dispatch. */
export const queueEventSchema = z.object({
  eventType: webhookEventTypeEnum,
  payload: z.record(z.string(), z.unknown()).describe('Event-specific data (varies by event type)'),
  summary: z.string().min(1, 'summary is required').describe('Human-readable one-liner for the event log'),
})

/** Query params for listing webhook events with pagination. */
export const listEventsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).default(200).describe('Maximum number of events to return (1–1000, default 200)'),
  offset: z.coerce.number().int().min(0).default(0).describe('Number of events to skip (default 0)'),
})

// ---- Registration schemas ----

/** Create a new webhook registration (admin only). */
export const createRegistrationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).describe('Human-readable name for this registration'),
  url: httpUrl,
  eventTypes: z.array(webhookEventTypeEnum).min(1, 'At least one event type is required').describe('Event types this registration subscribes to'),
})

/** Partial update for an existing webhook registration (admin only). */
export const updateRegistrationSchema = z.object({
  name: z.string().min(1).max(100).optional().describe('Updated registration name'),
  url: httpUrl.optional(),
  eventTypes: z.array(webhookEventTypeEnum).min(1).optional().describe('Updated event type subscriptions'),
})

// ---- Delivery schemas ----

/** Batch update delivery statuses (used by the dispatch engine). */
export const batchDeliveryStatusSchema = z.object({
  deliveries: z.array(z.object({
    id: requiredId.describe('Delivery ID'),
    status: webhookDeliveryStatusEnum,
    error: z.string().optional().describe('Error message (for failed deliveries)'),
  })).min(1, 'At least one delivery update is required'),
})

/** Update a single delivery's status with lifecycle validation. */
export const updateDeliveryStatusSchema = z.object({
  status: webhookDeliveryStatusEnum,
  error: z.string().optional().describe('Error message (for failed deliveries)'),
})

/** Query params for listing queued deliveries. */
export const listQueuedQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional().describe('Maximum number of queued deliveries to return (1–1000)'),
})
