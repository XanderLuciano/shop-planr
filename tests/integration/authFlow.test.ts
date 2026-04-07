/**
 * Integration tests for auth flows.
 *
 * Tests the full lifecycle through the service layer with real SQLite databases.
 */
import { describe, it, expect } from 'vitest'
import { createTestContext } from './helpers'
import { generateId } from '../../server/utils/idGenerator'
import { AuthenticationError, ForbiddenError } from '../../server/utils/errors'

describe('Auth Flow Integration', () => {
  describe('full login flow', () => {
    it('create user → setup PIN → login → verify JWT → access protected data', async () => {
      const ctx = createTestContext()
      try {
        await ctx.authService.ensureKeyPair()

        // Create user
        const user = ctx.repos.users.create({
          id: generateId('user'),
          username: 'worker1',
          displayName: 'Worker One',
          isAdmin: false,
          active: true,
          createdAt: new Date().toISOString(),
        })

        // Setup PIN
        const setupToken = await ctx.authService.setupPin(user.id, '1234')
        expect(typeof setupToken).toBe('string')

        // Verify PIN was stored
        const updated = ctx.repos.users.getById(user.id)
        expect(updated!.pinHash).toBeTruthy()

        // Login with PIN
        const loginToken = await ctx.authService.login('worker1', '1234')
        expect(typeof loginToken).toBe('string')

        // Verify JWT contains correct user data
        const payload = await ctx.authService.verifyToken(loginToken)
        expect(payload.sub).toBe(user.id)
        expect(payload.username).toBe('worker1')
        expect(payload.displayName).toBe('Worker One')
        expect(payload.isAdmin).toBe(false)
        expect(payload.active).toBe(true)
      } finally {
        ctx.cleanup()
      }
    })
  })

  describe('token refresh flow', () => {
    it('login → refresh → verify new token works', async () => {
      const ctx = createTestContext()
      try {
        await ctx.authService.ensureKeyPair()

        const user = ctx.repos.users.create({
          id: generateId('user'),
          username: 'refresher',
          displayName: 'Refresher',
          isAdmin: false,
          active: true,
          createdAt: new Date().toISOString(),
        })

        await ctx.authService.setupPin(user.id, '5555')
        const original = await ctx.authService.login('refresher', '5555')

        // Refresh
        const refreshed = await ctx.authService.refreshToken(original)
        expect(refreshed).not.toBe(original)

        // New token should be valid
        const payload = await ctx.authService.verifyToken(refreshed)
        expect(payload.sub).toBe(user.id)
        expect(payload.exp - payload.iat).toBe(86400)
      } finally {
        ctx.cleanup()
      }
    })
  })

  describe('admin PIN reset flow', () => {
    it('admin resets user PIN → user goes through setup flow again', async () => {
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

        const worker = ctx.repos.users.create({
          id: generateId('user'),
          username: 'worker',
          displayName: 'Worker',
          isAdmin: false,
          active: true,
          createdAt: new Date().toISOString(),
        })

        // Worker sets up PIN and logs in
        await ctx.authService.setupPin(worker.id, '1111')
        await ctx.authService.login('worker', '1111')

        // Admin resets worker's PIN
        ctx.authService.resetPin(admin.id, worker.id)

        // Worker's pinHash should be null
        const afterReset = ctx.repos.users.getById(worker.id)
        expect(afterReset!.pinHash).toBeUndefined()

        // Worker can't login with old PIN (no pinHash)
        await expect(ctx.authService.login('worker', '1111')).rejects.toThrow(AuthenticationError)

        // Worker sets up new PIN
        const newToken = await ctx.authService.setupPin(worker.id, '2222')
        expect(typeof newToken).toBe('string')

        // Worker can login with new PIN
        const loginToken = await ctx.authService.login('worker', '2222')
        const payload = await ctx.authService.verifyToken(loginToken)
        expect(payload.sub).toBe(worker.id)
      } finally {
        ctx.cleanup()
      }
    })

    it('non-admin cannot reset PINs', async () => {
      const ctx = createTestContext()
      try {
        await ctx.authService.ensureKeyPair()

        const user1 = ctx.repos.users.create({
          id: generateId('user'),
          username: 'user1',
          displayName: 'User 1',
          isAdmin: false,
          active: true,
          createdAt: new Date().toISOString(),
        })

        const user2 = ctx.repos.users.create({
          id: generateId('user'),
          username: 'user2',
          displayName: 'User 2',
          isAdmin: false,
          active: true,
          createdAt: new Date().toISOString(),
        })

        await ctx.authService.setupPin(user2.id, '3333')

        expect(() => ctx.authService.resetPin(user1.id, user2.id)).toThrow(ForbiddenError)

        // PIN should be unchanged
        const afterAttempt = ctx.repos.users.getById(user2.id)
        expect(afterAttempt!.pinHash).toBeTruthy()
      } finally {
        ctx.cleanup()
      }
    })
  })

  describe('first boot flow', () => {
    it('empty DB → default admin created → admin sets PIN → admin logs in', async () => {
      const ctx = createTestContext()
      try {
        await ctx.authService.ensureKeyPair()

        // Empty DB — ensureDefaultAdmin creates admin
        ctx.authService.ensureDefaultAdmin()

        const users = ctx.repos.users.list()
        expect(users.length).toBe(1)
        const admin = users[0]!
        expect(admin.username).toBe('admin')
        expect(admin.isAdmin).toBe(true)
        expect(admin.pinHash).toBeUndefined()

        // Admin sets PIN
        const setupToken = await ctx.authService.setupPin(admin.id, '0000')
        expect(typeof setupToken).toBe('string')

        // Admin logs in
        const loginToken = await ctx.authService.login('admin', '0000')
        const payload = await ctx.authService.verifyToken(loginToken)
        expect(payload.username).toBe('admin')
        expect(payload.isAdmin).toBe(true)
      } finally {
        ctx.cleanup()
      }
    })
  })

  describe('key pair persistence', () => {
    it('key pair survives across service instances', async () => {
      const ctx = createTestContext()
      try {
        await ctx.authService.ensureKeyPair()

        const user = ctx.repos.users.create({
          id: generateId('user'),
          username: 'persist',
          displayName: 'Persist',
          isAdmin: false,
          active: true,
          createdAt: new Date().toISOString(),
        })

        const token = await ctx.authService.signToken(user)

        // Create a new authService instance using the same DB repos
        const { createAuthService } = await import('../../server/services/authService')
        const authService2 = createAuthService({
          users: ctx.repos.users,
          cryptoKeys: ctx.repos.cryptoKeys,
        })
        await authService2.ensureKeyPair()

        // New instance should verify tokens signed by the first
        const payload = await authService2.verifyToken(token)
        expect(payload.sub).toBe(user.id)
      } finally {
        ctx.cleanup()
      }
    })
  })
})
