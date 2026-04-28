/**
 * Zod schemas for note API endpoints.
 *
 * These schemas validate request inputs at the API boundary, ensuring services
 * receive correctly-typed inputs.
 */
import { z } from 'zod'
import { requiredId } from './_primitives'

export const createNoteSchema = z.object({
  jobId: requiredId,
  pathId: requiredId,
  stepId: requiredId,
  partIds: z.array(requiredId).min(1, 'At least one partId is required'),
  text: z.string().min(1, 'text is required'),
})
