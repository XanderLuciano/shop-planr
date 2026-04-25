/**
 * Property 2: JWT structure completeness (Requirements 5.1–5.4)
 * Property 5: Valid JWT attaches user context (Requirements 6.1, 6.2)
 * Property 6: Missing or invalid token returns 401 (Requirements 6.3, 6.5)
 * Property 7: Token refresh produces a new valid token (Requirements 7.1, 7.4)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fc from 'fast-check'
import { decodeProtectedHeader } from 'jose'
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

describe('Property 2: JWT structure completeness', () => {
  it('signed JWT has ES256 header and complete payload with 24h expiry', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          username: fc.string({ minLength: 1, maxLength: 20 }).filter((s: string) => s.trim().length > 0),
          displayName: fc.string({ minLength: 1, maxLength: 30 }).filter((s: string) => s.trim().length > 0),
          isAdmin: fc.boolean(),
        }),
        async ({ username, displayName, isAdmin }) => {
          savepoint(ctx.db)
          try {
            await ctx.authService.ensureKeyPair()
            const user = ctx.repos.users.create({
              id: generateId('user'), username, displayName, isAdmin,
              active: true, createdAt: new Date().toISOString(),
            })
            const token = await ctx.authService.signToken(user)
            const header = decodeProtectedHeader(token)
            expect(header.alg).toBe('ES256')
            const payload = await ctx.authService.verifyToken(token)
            expect(payload.sub).toBe(user.id)
            expect(payload.username).toBe(user.username)
            expect(payload.displayName).toBe(user.displayName)
            expect(payload.isAdmin).toBe(user.isAdmin)
            expect(payload.active).toBe(true)
            expect(typeof payload.iat).toBe('number')
            expect(typeof payload.exp).toBe('number')
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
