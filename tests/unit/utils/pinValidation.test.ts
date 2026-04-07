/**
 * Unit tests for PIN format validation edge cases.
 * Tests the validation logic used by authService.setupPin().
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestContext } from '../../integration/helpers'
import { generateId } from '../../../server/utils/idGenerator'
import { ValidationError } from '../../../server/utils/errors'
import type { TestContext } from '../../integration/helpers'

let ctx: TestContext
let userId: string

beforeAll(async () => {
  ctx = createTestContext()
  await ctx.authService.ensureKeyPair()
  const user = ctx.repos.users.create({
    id: generateId('user'),
    username: 'pinval',
    displayName: 'Pin Val',
    isAdmin: false,
    active: true,
    createdAt: new Date().toISOString(),
  })
  userId = user.id
})

afterAll(() => {
  ctx.cleanup()
})

describe('PIN validation', () => {
  it('rejects empty string', async () => {
    await expect(ctx.authService.setupPin(userId, '')).rejects.toThrow(ValidationError)
  })

  it('rejects 3-digit PIN', async () => {
    await expect(ctx.authService.setupPin(userId, '123')).rejects.toThrow(ValidationError)
  })

  it('rejects 5-digit PIN', async () => {
    await expect(ctx.authService.setupPin(userId, '12345')).rejects.toThrow(ValidationError)
  })

  it('rejects letters', async () => {
    await expect(ctx.authService.setupPin(userId, 'abcd')).rejects.toThrow(ValidationError)
  })

  it('rejects special characters', async () => {
    await expect(ctx.authService.setupPin(userId, '12!4')).rejects.toThrow(ValidationError)
  })

  it('rejects spaces', async () => {
    await expect(ctx.authService.setupPin(userId, '1 34')).rejects.toThrow(ValidationError)
  })

  it('accepts 0000', async () => {
    const user = ctx.repos.users.create({
      id: generateId('user'),
      username: 'pinval_0000',
      displayName: 'Pin Val 0000',
      isAdmin: false,
      active: true,
      createdAt: new Date().toISOString(),
    })
    const token = await ctx.authService.setupPin(user.id, '0000')
    expect(typeof token).toBe('string')
  })

  it('accepts 9999', async () => {
    const user = ctx.repos.users.create({
      id: generateId('user'),
      username: 'pinval_9999',
      displayName: 'Pin Val 9999',
      isAdmin: false,
      active: true,
      createdAt: new Date().toISOString(),
    })
    const token = await ctx.authService.setupPin(user.id, '9999')
    expect(typeof token).toBe('string')
  })

  it('accepts PIN with leading zeros', async () => {
    const user = ctx.repos.users.create({
      id: generateId('user'),
      username: 'pinval_0001',
      displayName: 'Pin Val 0001',
      isAdmin: false,
      active: true,
      createdAt: new Date().toISOString(),
    })
    const token = await ctx.authService.setupPin(user.id, '0001')
    expect(typeof token).toBe('string')
  })
})
