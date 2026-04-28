/**
 * Zod schemas for template API endpoints.
 *
 * These schemas validate request inputs at the API boundary, ensuring services
 * receive correctly-typed inputs.
 */
import { z } from 'zod'

const templateStepSchema = z.object({
  name: z.string().min(1, 'Step name is required'),
  location: z.string().optional(),
})

const templateStepWithOptionsSchema = z.object({
  name: z.string().min(1, 'Step name is required'),
  location: z.string().optional(),
  optional: z.boolean().optional(),
  dependencyType: z.enum(['physical', 'preferred', 'completion_gate']).optional(),
})

export const createTemplateSchema = z.object({
  name: z.string().min(1, 'name is required'),
  steps: z.array(templateStepSchema).min(1, 'At least one step is required'),
})

export const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  steps: z.array(templateStepWithOptionsSchema).min(1).optional(),
})

export const applyTemplateSchema = z.object({
  jobId: z.string().min(1, 'jobId is required'),
  pathName: z.string().optional(),
  goalQuantity: z.number().int().positive('goalQuantity must be a positive integer'),
})
