/**
 * Unit tests for AuthService.
 */
import { describe, it, expect } from 'vitest'
import { createTestContext } from '../../integration/helpers'
import { generateId } from '../../../server/utils/idGenerator'
import { AuthenticationError, ForbiddenError } from '../../../server/utils/errors'

describe('authService', () => {
  describe('ensureDefaultAdmin', () => {
    it('creates admin user when users table is empty', () => {
      const ctx = createTestContext()
      try {
        ctx.authService.ensureDefaultAdmin()
        const users = ctx.repos.users.list()
        expect(users.length).toBe(1)
        expect(users[0]!.username).toBe('admin')
        expect(users[0]!.displayName).toBe('Administrator')
        expect(users[0]!.isAdmin).toBe(true)
        expect(users[0]!.pinHash).toBeUndefined()
      } finally {
        ctx.cleanup()
      }
    })

    it('does not create admin when users already exist', () => {
      const ctx = createTestContext()
      try {
        ctx.repos.users.create({
          id: generateId('user'),
          username: 'existing',
          displayName: 'Existing',
          isAdmin: false,
          active: true,
          createdAt: new Date().toISOString(),
        })

        ctx.authService.ensureDefaultAdmin()
        const users = ctx.repos.users.list()
        expect(users.length).toBe(1)
        expect(users[0]!.username).toBe('existing')
      } finally {
        ctx.cleanup()
      }
    })
  })

  describe('PIN setup happy path', () => {
    it('sets PIN and returns a valid JWT', async () => {
      const ctx = createTestContext()
      try {
        await ctx.authService.ensureKeyPair()
        const user = ctx.repos.users.create({
          id: generateId('user'),
          username: 'alice',
          displayName: 'Alice',
          isAdmin: false,
          active: true,
          createdAt: new Date().toISOString(),
        })

        const token = await ctx.authService.setupPin(user.id, '1234')
        expect(typeof token).toBe('string')

        // User should now have a pinHash
        const updated = ctx.repos.users.getById(user.id)
        expect(updated!.pinHash).toBeTruthy()

        // Token should be verifiable
        const payload = await ctx.authService.verifyToken(token)
        expect(payload.sub).toBe(user.id)
      } finally {
        ctx.cleanup()
      }
    })
  })

  describe('login happy path', () => {
    it('returns JWT for correct credentials', async () => {
      const ctx = createTestContext()
      try {
        await ctx.authService.ensureKeyPair()
        const user = ctx.repos.users.create({
          id: generateId('user'),
          username: 'bob',
          displayName: 'Bob',
          isAdmin: false,
          active: true,
          createdAt: new Date().toISOString(),
        })

        await ctx.authService.setupPin(user.id, '5678')
        const token = await ctx.authService.login('bob', '5678')
        expect(typeof token).toBe('string')

        const payload = await ctx.authService.verifyToken(token)
        expect(payload.sub).toBe(user.id)
        expect(payload.username).toBe('bob')
      } finally {
        ctx.cleanup()
      }
    })

    it('throws AuthenticationError for wrong PIN', async () => {
      const ctx = createTestContext()
      try {
        await ctx.authService.ensureKeyPair()
        const user = ctx.repos.users.create({
          id: generateId('user'),
          username: 'charlie',
          displayName: 'Charlie',
          isAdmin: false,
          active: true,
          createdAt: new Date().toISOString(),
        })

        await ctx.authService.setupPin(user.id, '1111')
        await expect(ctx.authService.login('charlie', '9999')).rejects.toThrow(AuthenticationError)
      } finally {
        ctx.cleanup()
      }
    })

    it('throws AuthenticationError for nonexistent user', async () => {
      const ctx = createTestContext()
      try {
        await ctx.authService.ensureKeyPair()
        await expect(ctx.authService.login('nobody', '1234')).rejects.toThrow(AuthenticationError)
      } finally {
        ctx.cleanup()
      }
    })
  })

  describe('refresh happy path', () => {
    it('returns a new valid JWT', async () => {
      const ctx = createTestContext()
      try {
        await ctx.authService.ensureKeyPair()
        const user = ctx.repos.users.create({
          id: generateId('user'),
          username: 'dave',
          displayName: 'Dave',
          isAdmin: false,
          active: true,
          createdAt: new Date().toISOString(),
        })

        const original = await ctx.authService.signToken(user)
        const refreshed = await ctx.authService.refreshToken(original)

        expect(refreshed).not.toBe(original)
        const payload = await ctx.authService.verifyToken(refreshed)
        expect(payload.sub).toBe(user.id)
      } finally {
        ctx.cleanup()
      }
    })
  })

  describe('admin PIN reset', () => {
    it('sets target user pinHash to null', async () => {
      const ctx = createTestContext()
      try {
        await ctx.authService.ensureKeyPair()

        const admin = ctx.repos.users.create({
          id: generateId('user'),
          username: 'admin',
          displayName: 'Admin',
          isAdmin: true,
          active: true,
          createdAt: new Date().toISOString(),
        })

        const target = ctx.repos.users.create({
          id: generateId('user'),
          username: 'target',
          displayName: 'Target',
          isAdmin: false,
          active: true,
          createdAt: new Date().toISOString(),
        })

        await ctx.authService.setupPin(target.id, '4321')
        expect(ctx.repos.users.getById(target.id)!.pinHash).toBeTruthy()

        ctx.authService.resetPin(admin.id, target.id)
        expect(ctx.repos.users.getById(target.id)!.pinHash).toBeUndefined()
      } finally {
        ctx.cleanup()
      }
    })

    it('throws ForbiddenError for non-admin', async () => {
      const ctx = createTestContext()
      try {
        await ctx.authService.ensureKeyPair()

        const nonAdmin = ctx.repos.users.create({
          id: generateId('user'),
          username: 'regular',
          displayName: 'Regular',
          isAdmin: false,
          active: true,
          createdAt: new Date().toISOString(),
        })

        const target = ctx.repos.users.create({
          id: generateId('user'),
          username: 'target2',
          displayName: 'Target 2',
          isAdmin: false,
          active: true,
          createdAt: new Date().toISOString(),
        })

        expect(() => ctx.authService.resetPin(nonAdmin.id, target.id)).toThrow(ForbiddenError)
      } finally {
        ctx.cleanup()
      }
    })
  })
})
