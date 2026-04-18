/**
 * Zod schemas for path and step API endpoints.
 *
 * These schemas validate request bodies at the API boundary,
 * ensuring services receive correctly-typed inputs.
 */
import { z } from 'zod'

const dependencyTypeEnum = z.enum(['physical', 'preferred', 'completion_gate'])
const advancementModeEnum = z.enum(['strict', 'flexible', 'per_step'])

// ── Step schemas ──

const stepInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Step name is required'),
  location: z.string().optional(),
  assignedTo: z.string().nullable().optional(),
  optional: z.boolean().optional(),
  dependencyType: dependencyTypeEnum.optional(),
})

export const createPathSchema = z.object({
  jobId: z.string().min(1, 'jobId is required'),
  name: z.string().min(1, 'name is required'),
  goalQuantity: z.number().int().positive('goalQuantity must be a positive integer'),
  advancementMode: advancementModeEnum.optional(),
  steps: z.array(stepInputSchema).min(1, 'At least one step is required'),
})

export const updatePathSchema = z.object({
  name: z.string().min(1).optional(),
  goalQuantity: z.number().int().positive().optional(),
  advancementMode: advancementModeEnum.optional(),
  steps: z.array(stepInputSchema).min(1).optional(),
})

export const updateAdvancementModeSchema = z.object({
  advancementMode: advancementModeEnum,
})

export const assignStepSchema = z.object({
  userId: z.string().nullable(),
})

export const updateStepConfigSchema = z.object({
  optional: z.boolean().optional(),
  location: z.string().optional(),
  dependencyType: dependencyTypeEnum.optional(),
}).refine(
  data => Object.values(data).some(v => v !== undefined),
  { message: 'No valid fields to update' },
)

export const batchDistributionsSchema = z.object({
  pathIds: z.array(z.string().min(1))
    .min(1, 'At least one path ID is required')
    .max(100, 'Cannot fetch more than 100 paths at once'),
})

// ── Batch path operations ──

const batchPathCreateSchema = z.object({
  name: z.string().min(1, 'name is required'),
  goalQuantity: z.number().int().positive('goalQuantity must be a positive integer'),
  advancementMode: advancementModeEnum.optional(),
  steps: z.array(stepInputSchema).min(1, 'At least one step is required'),
})

const batchPathUpdateSchema = z.object({
  pathId: z.string().min(1, 'pathId is required'),
  name: z.string().min(1).optional(),
  goalQuantity: z.number().int().positive().optional(),
  advancementMode: advancementModeEnum.optional(),
  steps: z.array(stepInputSchema).min(1).optional(),
})

export const batchPathOperationsSchema = z.object({
  create: z.array(batchPathCreateSchema).default([]),
  update: z.array(batchPathUpdateSchema).default([]),
  delete: z.array(z.string().min(1)).default([]),
}).refine(
  data => data.create.length + data.update.length + data.delete.length > 0,
  { message: 'At least one operation (create, update, or delete) is required' },
)
