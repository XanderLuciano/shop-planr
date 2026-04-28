/**
 * Zod schemas for part API endpoints.
 *
 * These schemas validate request inputs at the API boundary, ensuring services
 * receive correctly-typed inputs.
 */
import { z } from 'zod'
import { requiredId, positiveInt, scrapReasonEnum } from './_primitives'

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
  partIds: z.array(requiredId)
    .min(1, 'At least one part ID is required')
    .max(100, 'Cannot advance more than 100 parts at once'),
})

/**
 * Validates the request body for `POST /api/parts/batch-step-statuses`.
 * Accepts an array of 1–500 non-empty part ID strings.
 */
export const batchStepStatusesSchema = z.object({
  partIds: z.array(requiredId)
    .min(1, 'At least one part ID is required')
    .max(500, 'Cannot fetch more than 500 parts at once'),
})

/**
 * Validates the request body for `POST /api/parts/advance-to`.
 * Accepts an array of 1–100 part IDs, a target step ID, and an optional skip flag.
 */
export const batchAdvanceToSchema = z.object({
  partIds: z.array(requiredId)
    .min(1, 'At least one part ID is required')
    .max(100, 'Cannot advance more than 100 parts at once'),
  targetStepId: requiredId,
  skip: z.boolean().optional(),
})

/**
 * Validates the request body for `POST /api/parts`.
 * Batch-create parts for a path.
 */
export const createPartsSchema = z.object({
  jobId: requiredId,
  pathId: requiredId,
  quantity: positiveInt,
  certId: requiredId.optional(),
})

/**
 * Validates the request body for `POST /api/parts/:id/scrap`.
 */
export const scrapPartSchema = z.object({
  reason: scrapReasonEnum,
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
  targetStepId: requiredId,
  skip: z.boolean().optional(),
})

/**
 * Validates the request body for `POST /api/parts/:id/overrides`.
 */
export const createOverrideSchema = z.object({
  partIds: z.array(requiredId).min(1, 'At least one partId is required').optional(),
  serialIds: z.array(requiredId).min(1).optional(),
  stepId: requiredId,
  reason: z.string().min(1, 'reason is required'),
})

/**
 * Validates the request body for `POST /api/parts/:id/attach-cert`.
 */
export const attachCertSchema = z.object({
  certId: requiredId,
})

/**
 * Validates the request body for `POST /api/parts/:id/waive-step/:stepId`.
 */
export const waiveStepSchema = z.object({
  reason: z.string().min(1, 'reason is required'),
})
