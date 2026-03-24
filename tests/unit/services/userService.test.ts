import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createUserService } from '../../../server/services/userService'
import { NotFoundError, ValidationError } from '../../../server/utils/errors'
import type { UserRepository } from '../../../server/repositories/interfaces/userRepository'
import type { ShopUser } from '../../../server/types/domain'

function createMockUserRepo(): UserRepository {
  const store = new Map<string, ShopUser>()
  return {
    create: vi.fn((user: ShopUser) => {
      store.set(user.id, user)
      return user
    }),
    getById: vi.fn((id: string) => store.get(id) ?? null),
    list: vi.fn(() => [...store.values()]),
    listActive: vi.fn(() => [...store.values()].filter(u => u.active)),
    update: vi.fn((id: string, partial: Partial<ShopUser>) => {
      const existing = store.get(id)!
      const updated = { ...existing, ...partial }
      store.set(id, updated)
      return updated
    })
  }
}

describe('UserService', () => {
  let repo: UserRepository
  let service: ReturnType<typeof createUserService>

  beforeEach(() => {
    repo = createMockUserRepo()
    service = createUserService({ users: repo })
  })

  describe('createUser', () => {
    it('creates a user with generated ID and active=true', () => {
      const user = service.createUser({ name: 'Alice', department: 'QC' })
      expect(user.id).toMatch(/^user_/)
      expect(user.name).toBe('Alice')
      expect(user.department).toBe('QC')
      expect(user.active).toBe(true)
      expect(user.createdAt).toBeTruthy()
    })

    it('trims whitespace from name', () => {
      const user = service.createUser({ name: '  Bob  ' })
      expect(user.name).toBe('Bob')
    })

    it('throws ValidationError for empty name', () => {
      expect(() => service.createUser({ name: '' })).toThrow(ValidationError)
    })

    it('throws ValidationError for whitespace-only name', () => {
      expect(() => service.createUser({ name: '   ' })).toThrow(ValidationError)
    })
  })

  describe('getUser', () => {
    it('returns existing user', () => {
      const created = service.createUser({ name: 'Alice' })
      const found = service.getUser(created.id)
      expect(found.id).toBe(created.id)
    })

    it('throws NotFoundError for missing user', () => {
      expect(() => service.getUser('nonexistent')).toThrow(NotFoundError)
    })
  })

  describe('listUsers', () => {
    it('returns all users', () => {
      service.createUser({ name: 'Alice' })
      service.createUser({ name: 'Bob' })
      expect(service.listUsers()).toHaveLength(2)
    })
  })

  describe('listActiveUsers', () => {
    it('returns only active users', () => {
      const alice = service.createUser({ name: 'Alice' })
      service.createUser({ name: 'Bob' })
      service.deactivateUser(alice.id)
      expect(service.listActiveUsers()).toHaveLength(1)
    })
  })

  describe('updateUser', () => {
    it('updates name', () => {
      const user = service.createUser({ name: 'Alice' })
      const updated = service.updateUser(user.id, { name: 'Alicia' })
      expect(updated.name).toBe('Alicia')
    })

    it('updates department', () => {
      const user = service.createUser({ name: 'Alice' })
      const updated = service.updateUser(user.id, { department: 'Engineering' })
      expect(updated.department).toBe('Engineering')
    })

    it('throws NotFoundError for missing user', () => {
      expect(() => service.updateUser('nonexistent', { name: 'X' })).toThrow(NotFoundError)
    })

    it('throws ValidationError for empty name update', () => {
      const user = service.createUser({ name: 'Alice' })
      expect(() => service.updateUser(user.id, { name: '' })).toThrow(ValidationError)
    })
  })

  describe('deactivateUser', () => {
    it('sets active to false', () => {
      const user = service.createUser({ name: 'Alice' })
      const deactivated = service.deactivateUser(user.id)
      expect(deactivated.active).toBe(false)
    })

    it('throws NotFoundError for missing user', () => {
      expect(() => service.deactivateUser('nonexistent')).toThrow(NotFoundError)
    })
  })
})
