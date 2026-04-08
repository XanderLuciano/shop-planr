/**
 * Zod schemas for operator API endpoints.
 */
import { z } from 'zod'

export const workQueueQuerySchema = z.object({
  groupBy: z.enum(['user', 'location', 'step']).default('location'),
})
