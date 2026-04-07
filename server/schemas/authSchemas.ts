import { z } from 'zod'

export const loginSchema = z.object({
  username: z.string().min(1, 'username is required'),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
})

export const setupPinSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
})

export const resetPinSchema = z.object({
  targetUserId: z.string().min(1, 'targetUserId is required'),
})
