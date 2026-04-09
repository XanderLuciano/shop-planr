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
  id: z.string().min(1, 'Part id is required'),
})
