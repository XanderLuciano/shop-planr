/**
 * Zod schemas for certificate API endpoints.
 *
 * These schemas validate request inputs at the API boundary, ensuring services
 * receive correctly-typed inputs.
 */
import { z } from 'zod'

export const createCertSchema = z.object({
  type: z.enum(['material', 'process']),
  name: z.string().min(1, 'name is required'),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const batchAttachCertSchema = z.object({
  certId: z.string().min(1, 'certId is required'),
  partIds: z.array(z.string().min(1)).min(1, 'At least one partId is required'),
  stepId: z.string().min(1, 'stepId is required'),
})
