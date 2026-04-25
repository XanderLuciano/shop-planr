/**
 * Property 1: PIN bcrypt round-trip (Requirements 3.3, 4.2)
 * Property 3: PIN validation rejects non-4-digit input (Requirements 3.6, 4.5)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fc from 'fast-check'
import { hashSync, compareSync } from 'bcryptjs'
import { createReusableTestContext, savepoint, rollback, type TestContext } from './helpers'
import { generateId } from '../../server/utils/idGenerator'
import { ValidationError } from '../../server/utils/errors'

const arbPin = fc.integer({ min: 0, max: 9999 }).map((n: number) => String(n).padStart(4, '0'))
const arbInvalidPin = fc.string({ minLength: 0, maxLength: 20 }).filter((s: string) => !/^\d{4}$/.test(s))

// File-level ctx — shared across all describe blocks
let ctx: TestContext

beforeAll(() => {
  ctx = createReusableTestContext()
})

afterAll(() => {
  ctx?.cleanup()
})

describe('Property 1: PIN bcrypt round-trip', () => {
  it('hashing then comparing the same PIN returns true, different PIN returns false', () => {
    fc.assert(
      fc.property(arbPin, arbPin, (pin: string, otherPin: string) => {
        const hash = hashSync(pin, 10)
        expect(compareSync(pin, hash)).toBe(true)
        if (pin !== otherPin) {
          expect(compareSync(otherPin, hash)).toBe(false)
        }
      }),
      { numRuns: 20 },
    )
  }, 30000)
})

describe('Property 3: PIN validation rejects non-4-digit input', () => {
  it('rejects non-4-digit strings', async () => {
    await fc.assert(
      fc.asyncProperty(arbInvalidPin, async (pin: string) => {
        savepoint(ctx.db)
        try {
          await ctx.authService.ensureKeyPair()
          const user = ctx.repos.users.create({
            id: generateId('user'),
            username: 'pintest',
            displayName: 'Pin Test',
            isAdmin: false,
            active: true,
            createdAt: new Date().toISOString(),
          })
          await expect(ctx.authService.setupPin(user.id, pin)).rejects.toThrow(ValidationError)
        } finally {
          rollback(ctx.db)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('accepts valid 4-digit PINs', { timeout: 30_000 }, async () => {
    await fc.assert(
      fc.asyncProperty(arbPin, async (pin: string) => {
        savepoint(ctx.db)
        try {
          await ctx.authService.ensureKeyPair()
          const user = ctx.repos.users.create({
            id: generateId('user'),
            username: 'pintest',
            displayName: 'Pin Test',
            isAdmin: false,
            active: true,
            createdAt: new Date().toISOString(),
          })
          const token = await ctx.authService.setupPin(user.id, pin)
          expect(typeof token).toBe('string')
          expect(token.split('.').length).toBe(3)
        } finally {
          rollback(ctx.db)
        }
      }),
      { numRuns: 50 },
    )
  })
})
