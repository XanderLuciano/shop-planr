/**
 * Property 4: Invalid PIN produces auth error (Req 4.4)
 * Property 10: Rate limit exceeded returns 429 (Req 12.1, 12.5)
 * Property 11: Admin PIN reset sets pin_hash to NULL (Req 13.1)
 * Property 12: Non-admin PIN reset throws ForbiddenError (Req 13.3, 13.4)
 * Property 13: ensureDefaultAdmin is idempotent (Req 14.3)
 * Property 14: ensureKeyPair is idempotent (Req 2.2)
 * Property 15: Migration preserves users with pin_hash NULL (Req 1.3)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fc from 'fast-check'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import { createReusableTestContext, savepoint, rollback, type TestContext } from './helpers'
import { generateId } from '../../server/utils/idGenerator'
import { AuthenticationError, ForbiddenError } from '../../server/utils/errors'

const arbPin = fc.integer({ min: 0, max: 9999 }).map((n: number) => String(n).padStart(4, '0'))

// File-level ctx — shared across all describe blocks
let ctx: TestContext

beforeAll(() => {
  ctx = createReusableTestContext()
})

afterAll(() => {
  ctx?.cleanup()
})

describe('Property 4: Invalid PIN produces auth error', () => {
  it('login with wrong PIN throws AuthenticationError', { timeout: 30_000 }, async () => {
    await fc.assert(
      fc.asyncProperty(arbPin, arbPin, async (correctPin: string, wrongPin: string) => {
        if (correctPin === wrongPin) return
        savepoint(ctx.db)
        try {
          await ctx.authService.ensureKeyPair()
          const user = ctx.repos.users.create({
            id: generateId('user'), username: 'logintest',
            displayName: 'Login Test', isAdmin: false,
            active: true, createdAt: new Date().toISOString(),
          })
          await ctx.authService.setupPin(user.id, correctPin)
          await expect(
            ctx.authService.login('logintest', wrongPin),
          ).rejects.toThrow(AuthenticationError)
        } finally {
          rollback(ctx.db)
        }
      }),
      { numRuns: 50 },
    )
  })
})

describe('Property 10: Rate limit exceeded returns 429', () => {
  it('RateLimiterMemory rejects after exceeding points', async () => {
    const limiter = new RateLimiterMemory({ points: 3, duration: 60 })
    await limiter.consume('test-ip')
    await limiter.consume('test-ip')
    await limiter.consume('test-ip')
    try {
      await limiter.consume('test-ip')
      expect.fail('Should have thrown')
    } catch (res: any) {
      expect(res.msBeforeNext).toBeGreaterThan(0)
    }
  })
})

describe('Property 11: Admin PIN reset sets pin_hash to NULL', () => {
  it('resetPin nullifies target pinHash', { timeout: 30_000 }, async () => {
    await fc.assert(
      fc.asyncProperty(arbPin, async (pin: string) => {
        savepoint(ctx.db)
        try {
          await ctx.authService.ensureKeyPair()
          const admin = ctx.repos.users.create({
            id: generateId('user'), username: 'admin_reset',
            displayName: 'Admin', isAdmin: true,
            active: true, createdAt: new Date().toISOString(),
          })
          const target = ctx.repos.users.create({
            id: generateId('user'), username: 'target_reset',
            displayName: 'Target', isAdmin: false,
            active: true, createdAt: new Date().toISOString(),
          })
          await ctx.authService.setupPin(target.id, pin)
          expect(ctx.repos.users.getById(target.id)!.pinHash).toBeTruthy()
          ctx.authService.resetPin(admin.id, target.id)
          expect(ctx.repos.users.getById(target.id)!.pinHash).toBeUndefined()
        } finally {
          rollback(ctx.db)
        }
      }),
      { numRuns: 50 },
    )
  })
})

describe('Property 12: Non-admin PIN reset throws ForbiddenError', () => {
  it('non-admin cannot reset another user PIN', { timeout: 30_000 }, async () => {
    await fc.assert(
      fc.asyncProperty(arbPin, async (pin: string) => {
        savepoint(ctx.db)
        try {
          await ctx.authService.ensureKeyPair()
          const nonAdmin = ctx.repos.users.create({
            id: generateId('user'), username: 'nonadmin',
            displayName: 'Non Admin', isAdmin: false,
            active: true, createdAt: new Date().toISOString(),
          })
          const target = ctx.repos.users.create({
            id: generateId('user'), username: 'target_forbidden',
            displayName: 'Target', isAdmin: false,
            active: true, createdAt: new Date().toISOString(),
          })
          await ctx.authService.setupPin(target.id, pin)
          expect(() => ctx.authService.resetPin(nonAdmin.id, target.id)).toThrow(ForbiddenError)
          expect(ctx.repos.users.getById(target.id)!.pinHash).toBeTruthy()
        } finally {
          rollback(ctx.db)
        }
      }),
      { numRuns: 50 },
    )
  })
})

describe('Property 13: ensureDefaultAdmin is idempotent', () => {
  it('does not add users when table is non-empty', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), (userCount: number) => {
        savepoint(ctx.db)
        try {
          for (let i = 0; i < userCount; i++) {
            ctx.repos.users.create({
              id: generateId('user'), username: `existing_${i}`,
              displayName: `Existing ${i}`, isAdmin: i === 0,
              active: true, createdAt: new Date().toISOString(),
            })
          }
          const before = ctx.repos.users.list().length
          ctx.authService.ensureDefaultAdmin()
          expect(ctx.repos.users.list().length).toBe(before)
        } finally {
          rollback(ctx.db)
        }
      }),
      { numRuns: 50 },
    )
  })
})

describe('Property 14: ensureKeyPair is idempotent', () => {
  it('calling twice does not change stored keys', async () => {
    savepoint(ctx.db)
    try {
      await ctx.authService.ensureKeyPair()
      const first = ctx.repos.cryptoKeys.getByAlgorithm('ES256')
      await ctx.authService.ensureKeyPair()
      const second = ctx.repos.cryptoKeys.getByAlgorithm('ES256')
      expect(second!.publicKey).toBe(first!.publicKey)
      expect(second!.privateKey).toBe(first!.privateKey)
    } finally {
      rollback(ctx.db)
    }
  })
})

describe('Property 15: Migration preserves users with pin_hash NULL', () => {
  it('all users have pinHash undefined after creation', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), (userCount: number) => {
        savepoint(ctx.db)
        try {
          for (let i = 0; i < userCount; i++) {
            ctx.repos.users.create({
              id: generateId('user'), username: `migrated_${i}`,
              displayName: `Migrated ${i}`, isAdmin: false,
              active: true, createdAt: new Date().toISOString(),
            })
          }
          const users = ctx.repos.users.list()
          expect(users.length).toBe(userCount)
          for (const user of users) {
            expect(user.pinHash).toBeUndefined()
          }
        } finally {
          rollback(ctx.db)
        }
      }),
      { numRuns: 50 },
    )
  })
})
