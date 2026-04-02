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
    getByUsername: vi.fn((username: string) => {
      for (const user of store.values()) {
        if (user.username === username) return user
      }
      return null
    }),
    list: vi.fn(() => [...store.values()]),
    listActive: vi.fn(() => [...store.values()].filter(u => u.active)),
    update: vi.fn((id: string, partial: Partial<ShopUser>) => {
      const existing = store.get(id)!
      const updated = { ...existing, ...partial }
      store.set(id, updated)
      return updated
    }),
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
      const user = service.createUser({ username: 'alice', displayName: 'Alice', department: 'QC' })
      expect(user.id).toMatch(/^user_/)
      expect(user.username).toBe('alice')
      expect(user.displayName).toBe('Alice')
      expect(user.department).toBe('QC')
      expect(user.active).toBe(true)
      expect(user.createdAt).toBeTruthy()
    })

    it('trims whitespace from username and displayName', () => {
      const user = service.createUser({ username: '  bob  ', displayName: '  Bob Smith  ' })
      expect(user.username).toBe('bob')
      expect(user.displayName).toBe('Bob Smith')
    })

    it('throws ValidationError for empty username', () => {
      expect(() => service.createUser({ username: '', displayName: 'Alice' })).toThrow(ValidationError)
    })

    it('throws ValidationError for whitespace-only username', () => {
      expect(() => service.createUser({ username: '   ', displayName: 'Alice' })).toThrow(ValidationError)
    })

    it('throws ValidationError for empty displayName', () => {
      expect(() => service.createUser({ username: 'alice', displayName: '' })).toThrow(ValidationError)
    })

    it('throws ValidationError for whitespace-only displayName', () => {
      expect(() => service.createUser({ username: 'alice', displayName: '   ' })).toThrow(ValidationError)
    })

    it('defaults isAdmin to false when not specified', () => {
      const user = service.createUser({ username: 'alice', displayName: 'Alice' })
      expect(user.isAdmin).toBe(false)
    })

    it('persists isAdmin=true on create', () => {
      const user = service.createUser({ username: 'admin1', displayName: 'Admin One', isAdmin: true })
      expect(user.isAdmin).toBe(true)
    })

    it('throws ValidationError for duplicate username', () => {
      service.createUser({ username: 'alice', displayName: 'Alice' })
      expect(() => service.createUser({ username: 'alice', displayName: 'Alice 2' })).toThrow(ValidationError)
    })
  })

  describe('getUser', () => {
    it('returns existing user', () => {
      const created = service.createUser({ username: 'alice', displayName: 'Alice' })
      const found = service.getUser(created.id)
      expect(found.id).toBe(created.id)
    })

    it('throws NotFoundError for missing user', () => {
      expect(() => service.getUser('nonexistent')).toThrow(NotFoundError)
    })
  })

  describe('listUsers', () => {
    it('returns all users', () => {
      service.createUser({ username: 'alice', displayName: 'Alice' })
      service.createUser({ username: 'bob', displayName: 'Bob' })
      expect(service.listUsers()).toHaveLength(2)
    })
  })

  describe('listActiveUsers', () => {
    it('returns only active users', () => {
      const alice = service.createUser({ username: 'alice', displayName: 'Alice' })
      service.createUser({ username: 'bob', displayName: 'Bob' })
      service.deactivateUser(alice.id)
      expect(service.listActiveUsers()).toHaveLength(1)
    })
  })

  describe('updateUser', () => {
    it('updates displayName', () => {
      const user = service.createUser({ username: 'alice', displayName: 'Alice' })
      const updated = service.updateUser(user.id, { displayName: 'Alicia' })
      expect(updated.displayName).toBe('Alicia')
    })

    it('updates username', () => {
      const user = service.createUser({ username: 'alice', displayName: 'Alice' })
      const updated = service.updateUser(user.id, { username: 'alicia' })
      expect(updated.username).toBe('alicia')
    })

    it('updates department', () => {
      const user = service.createUser({ username: 'alice', displayName: 'Alice' })
      const updated = service.updateUser(user.id, { department: 'Engineering' })
      expect(updated.department).toBe('Engineering')
    })

    it('persists isAdmin on update', () => {
      const user = service.createUser({ username: 'alice', displayName: 'Alice' })
      expect(user.isAdmin).toBe(false)
      const updated = service.updateUser(user.id, { isAdmin: true })
      expect(updated.isAdmin).toBe(true)
    })

    it('throws NotFoundError for missing user', () => {
      expect(() => service.updateUser('nonexistent', { displayName: 'X' })).toThrow(NotFoundError)
    })

    it('throws ValidationError for empty displayName update', () => {
      const user = service.createUser({ username: 'alice', displayName: 'Alice' })
      expect(() => service.updateUser(user.id, { displayName: '' })).toThrow(ValidationError)
    })

    it('throws ValidationError for empty username update', () => {
      const user = service.createUser({ username: 'alice', displayName: 'Alice' })
      expect(() => service.updateUser(user.id, { username: '' })).toThrow(ValidationError)
    })

    it('throws ValidationError when updating username to one already taken', () => {
      service.createUser({ username: 'alice', displayName: 'Alice' })
      const bob = service.createUser({ username: 'bob', displayName: 'Bob' })
      expect(() => service.updateUser(bob.id, { username: 'alice' })).toThrow(ValidationError)
    })

    it('allows updating username to the same value (no-op uniqueness)', () => {
      const user = service.createUser({ username: 'alice', displayName: 'Alice' })
      const updated = service.updateUser(user.id, { username: 'alice' })
      expect(updated.username).toBe('alice')
    })
  })

  describe('deactivateUser', () => {
    it('sets active to false', () => {
      const user = service.createUser({ username: 'alice', displayName: 'Alice' })
      const deactivated = service.deactivateUser(user.id)
      expect(deactivated.active).toBe(false)
    })

    it('throws NotFoundError for missing user', () => {
      expect(() => service.deactivateUser('nonexistent')).toThrow(NotFoundError)
    })
  })
})
