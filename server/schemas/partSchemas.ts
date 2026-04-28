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
 * Validates the request body for `POST /api/parts/:id/waive-step/:stepId`.
 */
export const waiveStepSchema = z.object({
  reason: z.string().min(1, 'reason is required'),
})
