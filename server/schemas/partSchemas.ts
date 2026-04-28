/**
 * Zod schemas for part API endpoints.
 *
 * These schemas validate request inputs at the API boundary, ensuring services
 * receive correctly-typed inputs.
 */
import { z } from 'zod'

/**
 * Validates the `id` route param for single-part endpoints such as
 * `DELETE /api/parts/:id`. Accepts both legacy `SN-` and new `part_` prefixed
 * IDs — the service passes IDs through without prefix validation.
 */
export const partIdParamSchema = z.object({
  id: z.string({ error: 'Part id is required' })
    .min(1, { error: 'Part id is required' }),
})

/**
 * Validates the request body for `POST /api/parts/advance`.
 * Accepts an array of 1–100 non-empty part ID strings.
 */
export const batchAdvanceSchema = z.object({
  partIds: z.array(
    z.string().min(1, { error: 'Part ID must be non-empty' }),
  )
    .min(1, { error: 'At least one part ID is required' })
    .max(100, { error: 'Cannot advance more than 100 parts at once' }),
})

/**
 * Validates the request body for `POST /api/parts/batch-step-statuses`.
 * Accepts an array of 1–500 non-empty part ID strings.
 */
export const batchStepStatusesSchema = z.object({
  partIds: z.array(z.string().min(1))
    .min(1, 'At least one part ID is required')
    .max(500, 'Cannot fetch more than 500 parts at once'),
})

/**
 * Validates the request body for `POST /api/parts/advance-to`.
 * Accepts an array of 1–100 part IDs, a target step ID, and an optional skip flag.
 */
export const batchAdvanceToSchema = z.object({
  partIds: z.array(z.string().min(1))
    .min(1, 'At least one part ID is required')
    .max(100, 'Cannot advance more than 100 parts at once'),
  targetStepId: z.string().min(1, 'targetStepId is required'),
  skip: z.boolean().optional(),
})

/**
 * Validates the request body for `POST /api/parts`.
 * Batch-create parts for a path.
 */
export const createPartsSchema = z.object({
  jobId: z.string().min(1, 'jobId is required'),
  pathId: z.string().min(1, 'pathId is required'),
  quantity: z.number().int().positive('quantity must be a positive integer'),
  certId: z.string().min(1).optional(),
})

/**
 * Validates the request body for `POST /api/parts/:id/scrap`.
 */
export const scrapPartSchema = z.object({
  reason: z.enum(['out_of_tolerance', 'process_defect', 'damaged', 'operator_error', 'other']),
  explanation: z.string().optional(),
})

/**
 * Validates the request body for `POST /api/parts/:id/force-complete`.
 */
export const forceCompleteSchema = z.object({
  reason: z.string().optional(),
})

/**
 * Validates the request body for `POST /api/parts/:id/advance-to`.
 */
export const advanceToStepSchema = z.object({
  targetStepId: z.string().min(1, 'targetStepId is required'),
  skip: z.boolean().optional(),
})

/**
 * Validates the request body for `POST /api/parts/:id/overrides`.
 */
export const createOverrideSchema = z.object({
  partIds: z.array(z.string().min(1)).min(1, 'At least one partId is required').optional(),
  serialIds: z.array(z.string().min(1)).min(1).optional(),
  stepId: z.string().min(1, 'stepId is required'),
  reason: z.string().min(1, 'reason is required'),
})

/**
 * Validates the request body for `POST /api/parts/:id/attach-cert`.
 */
export const attachCertSchema = z.object({
  certId: z.string().min(1, 'certId is required'),
})

/**
 * Validates the request body for `POST /api/parts/:id/waive-step/:stepId`.
 */
export const waiveStepSchema = z.object({
  reason: z.string().min(1, 'reason is required'),
})
