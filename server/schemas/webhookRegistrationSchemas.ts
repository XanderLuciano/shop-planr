/**
 * Zod schemas for webhook registration and delivery API endpoints.
 *
 * These schemas validate request inputs at the API boundary, ensuring services
 * receive correctly-typed inputs.
 */
import { z } from 'zod'
import { requiredId } from './_primitives'

export const createRegistrationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  url: z.string().min(1, 'URL is required').url('Must be a valid URL'),
  eventTypes: z.array(z.string()).min(1, 'At least one event type is required'),
})

export const updateRegistrationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().min(1).url().optional(),
  eventTypes: z.array(z.string()).min(1).optional(),
})

export const batchDeliveryStatusSchema = z.object({
  deliveries: z.array(z.object({
    id: requiredId,
    status: z.enum(['delivering', 'delivered', 'failed', 'queued', 'canceled']),
    error: z.string().optional(),
  })).min(1),
})

export const updateDeliveryStatusSchema = z.object({
  status: z.enum(['delivering', 'delivered', 'failed', 'queued', 'canceled']),
  error: z.string().optional(),
})
