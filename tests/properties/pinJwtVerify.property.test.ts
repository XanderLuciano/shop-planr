/**
 * Property 5: Valid JWT attaches user context (Requirements 6.1, 6.2)
 * Property 6: Missing or invalid token (Requirements 6.3, 6.5)
 * Property 7: Token refresh (Requirements 7.1, 7.4)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fc from 'fast-check'
import { createReusableTestContext, savepoint, rollback, type TestContext } from './helpers'
import { generateId } from '../../server/utils/idGenerator'

// File-level ctx — shared across all describe blocks
let ctx: TestContext

beforeAll(() => {
  ctx = createReusableTestContext()
})

afterAll(() => {
  ctx?.cleanup()
})

describe('Property 5: Valid JWT attaches user context', () => {
  it('verifyToken decodes a valid JWT with matching user fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          username: fc.string({ minLength: 1, maxLength: 20 }).filter((s: string) => s.trim().length > 0),
          isAdmin: fc.boolean(),
        }),
        async ({ username, isAdmin }) => {
          savepoint(ctx.db)
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
            rollback(ctx.db)
          }
        },
      ),
      { numRuns: 50 },
    )
  })
})

describe('Property 6: Missing or invalid token', () => {
  it('verifyToken rejects garbage tokens', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }),
        async (garbage: string) => {
          savepoint(ctx.db)
          try {
            await ctx.authService.ensureKeyPair()
            await expect(ctx.authService.verifyToken(garbage)).rejects.toThrow()
          } finally {
            rollback(ctx.db)
          }
        },
      ),
      { numRuns: 50 },
    )
  })
})

describe('Property 7: Token refresh produces a new valid token', () => {
  it('refreshToken returns a new JWT verifiable with the same key', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          username: fc.string({ minLength: 1, maxLength: 20 }).filter((s: string) => s.trim().length > 0),
        }),
        async ({ username }) => {
          savepoint(ctx.db)
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
            rollback(ctx.db)
          }
        },
      ),
      { numRuns: 50 },
    )
  })
})
