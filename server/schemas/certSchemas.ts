/**
 * Zod schemas for certificate API endpoints.
 *
 * These schemas validate request inputs at the API boundary, ensuring services
 * receive correctly-typed inputs.
 */
import { z } from 'zod'
import { requiredId, certTypeEnum } from './_primitives'

export const createCertSchema = z.object({
  type: certTypeEnum,
  name: z.string().min(1, 'name is required'),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const batchAttachCertSchema = z.object({
  certId: requiredId,
  partIds: z.array(requiredId).min(1, 'At least one partId is required'),
  stepId: requiredId,
})
