/**
 * Zod schemas for template API endpoints.
 *
 * These schemas validate request inputs at the API boundary, ensuring services
 * receive correctly-typed inputs.
 */
import { z } from 'zod'
import { requiredId, positiveInt, dependencyTypeEnum } from './_primitives'

const templateStepSchema = z.object({
  name: z.string().min(1, 'Step name is required'),
  location: z.string().optional(),
  optional: z.boolean().optional(),
  dependencyType: dependencyTypeEnum.optional(),
})

export const createTemplateSchema = z.object({
  name: z.string().min(1, 'name is required'),
  steps: z.array(templateStepSchema).min(1, 'At least one step is required'),
})

export const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  steps: z.array(templateStepSchema).min(1).optional(),
})

export const applyTemplateSchema = z.object({
  jobId: requiredId,
  pathName: z.string().optional(),
  goalQuantity: positiveInt,
})
