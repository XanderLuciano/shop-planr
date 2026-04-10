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
