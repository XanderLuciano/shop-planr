/**
 * Zod schemas for user API endpoints.
 *
 * These schemas validate request inputs at the API boundary, ensuring services
 * receive correctly-typed inputs.
 */
import { z } from 'zod'

export const createUserSchema = z.object({
  username: z.string().min(1, 'username is required'),
  displayName: z.string().min(1, 'displayName is required'),
  department: z.string().optional(),
  isAdmin: z.boolean().optional(),
})

export const updateUserSchema = z.object({
  username: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  department: z.string().optional(),
  active: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
})
