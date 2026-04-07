/**
 * Property 5: Valid JWT attaches user context (Requirements 6.1, 6.2)
 * Property 6: Missing or invalid token (Requirements 6.3, 6.5)
 * Property 7: Token refresh (Requirements 7.1, 7.4)
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { createTestContext } from '../integration/helpers'
import { generateId } from '../../server/utils/idGenerator'

describe('Property 5: Valid JWT attaches user context', () => {
  it('verifyToken decodes a valid JWT with matching user fields', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          username: fc.string({ minLength: 1, maxLength: 20 }).filter((s: string) => s.trim().length > 0),
          isAdmin: fc.boolean(),
        }),
        async ({ username, isAdmin }) => {
          const ctx = createTestContext()
          try {
            await ctx.authService.ensureKeyPair()
            const user = ctx.repos.users.create({
              id: generateId('user'), username,
              displayName: `User ${username}`,
              isAdmin, active: true,
              createdAt: new Date().toISOString(),
            })
            const token = await ctx.authService.signToken(user)
            const payload = await ctx.authService.verifyToken(token)
            expect(payload.sub).toBe(user.id)
            expect(payload.username).toBe(user.username)
            expect(payload.isAdmin).toBe(user.isAdmin)
          } finally {
            ctx.cleanup()
          }
        },
      ),
      { numRuns: 50 },
    )
  })
})

describe('Property 6: Missing or invalid token', () => {
  it('verifyToken rejects garbage tokens', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }),
        async (garbage: string) => {
          const ctx = createTestContext()
          try {
            await ctx.authService.ensureKeyPair()
            await expect(ctx.authService.verifyToken(garbage)).rejects.toThrow()
          } finally {
            ctx.cleanup()
          }
        },
      ),
      { numRuns: 50 },
    )
  })
})

describe('Property 7: Token refresh produces a new valid token', () => {
  it('refreshToken returns a new JWT verifiable with the same key', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          username: fc.string({ minLength: 1, maxLength: 20 }).filter((s: string) => s.trim().length > 0),
        }),
        async ({ username }) => {
          const ctx = createTestContext()
          try {
            await ctx.authService.ensureKeyPair()
            const user = ctx.repos.users.create({
              id: generateId('user'), username,
              displayName: `User ${username}`,
              isAdmin: false, active: true,
              createdAt: new Date().toISOString(),
            })
            const original = await ctx.authService.signToken(user)
            const refreshed = await ctx.authService.refreshToken(original)
            expect(refreshed).not.toBe(original)
            const payload = await ctx.authService.verifyToken(refreshed)
            expect(payload.sub).toBe(user.id)
            expect(payload.exp - payload.iat).toBe(86400)
          } finally {
            ctx.cleanup()
          }
        },
      ),
      { numRuns: 50 },
    )
  })
})
