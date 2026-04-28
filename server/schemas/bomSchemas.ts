/**
 * Zod schemas for BOM API endpoints.
 *
 * These schemas validate request inputs at the API boundary, ensuring services
 * receive correctly-typed inputs.
 */
import { z } from 'zod'
import { requiredId } from './_primitives'

const bomEntrySchema = z.object({
  jobId: requiredId,
  requiredQuantity: z.number()
    .int('requiredQuantity must be an integer')
    .min(1, 'requiredQuantity must be at least 1')
    .optional()
    .default(1),
})

export const createBomSchema = z.object({
  name: z.string().min(1, 'BOM name is required').trim(),
  entries: z.array(bomEntrySchema)
    .min(1, 'At least one entry is required'),
})

export const updateBomSchema = z.object({
  name: z.string().min(1, 'BOM name is required').trim().optional(),
  entries: z.array(bomEntrySchema)
    .min(1, 'At least one entry is required')
    .optional(),
})

export const editBomSchema = z.object({
  name: z.string().min(1, 'BOM name is required').trim().optional(),
  entries: z.array(bomEntrySchema)
    .min(1, 'At least one entry is required'),
  changeDescription: z.string().min(1, 'changeDescription is required'),
})

export const bomListQuerySchema = z.object({
  status: z.enum(['active', 'archived', 'all']).default('active'),
})
