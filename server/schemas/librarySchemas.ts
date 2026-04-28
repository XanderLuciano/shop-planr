/**
 * Zod schemas for library API endpoints.
 *
 * These schemas validate request inputs at the API boundary, ensuring services
 * receive correctly-typed inputs.
 */
import { z } from 'zod'

export const addLibraryEntrySchema = z.object({
  name: z.string().min(1, 'name is required'),
})
