/**
 * Zod schemas for auth API endpoints.
 */
import { z } from 'zod'
import { requiredId, pinSchema } from './_primitives'

export const loginSchema = z.object({
  username: z.string().min(1, 'username is required'),
  pin: pinSchema,
})

export const setupPinSchema = z.object({
  userId: requiredId,
  pin: pinSchema,
})

export const resetPinSchema = z.object({
  targetUserId: requiredId,
})

export const refreshTokenSchema = z.object({
  token: z.string().min(1, 'Bearer token is required'),
})
