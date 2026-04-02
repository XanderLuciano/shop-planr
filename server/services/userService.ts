import type { UserRepository } from '../repositories/interfaces/userRepository'
import type { ShopUser } from '../types/domain'
import { generateId } from '../utils/idGenerator'
import { assertNonEmpty } from '../utils/validation'
import { NotFoundError, ValidationError } from '../utils/errors'

export function createUserService(repos: { users: UserRepository }) {
  return {
    createUser(input: { username: string, displayName: string, department?: string, isAdmin?: boolean }): ShopUser {
      assertNonEmpty(input.username, 'username')
      assertNonEmpty(input.displayName, 'displayName')

      const trimmedUsername = input.username.trim()
      const trimmedDisplayName = input.displayName.trim()

      const existing = repos.users.getByUsername(trimmedUsername)
      if (existing) {
        throw new ValidationError(`Username '${trimmedUsername}' is already taken`)
      }

      return repos.users.create({
        id: generateId('user'),
        username: trimmedUsername,
        displayName: trimmedDisplayName,
        isAdmin: input.isAdmin ?? false,
        department: input.department,
        active: true,
        createdAt: new Date().toISOString(),
      })
    },

    getUser(id: string): ShopUser {
      const user = repos.users.getById(id)
      if (!user) {
        throw new NotFoundError('User', id)
      }
      return user
    },

    listUsers(): ShopUser[] {
      return repos.users.list()
    },

    listActiveUsers(): ShopUser[] {
      return repos.users.listActive()
    },

    updateUser(id: string, input: { username?: string, displayName?: string, department?: string, active?: boolean, isAdmin?: boolean }): ShopUser {
      const existing = repos.users.getById(id)
      if (!existing) {
        throw new NotFoundError('User', id)
      }

      if (input.username !== undefined) {
        assertNonEmpty(input.username, 'username')
      }
      if (input.displayName !== undefined) {
        assertNonEmpty(input.displayName, 'displayName')
      }

      const partial: Partial<ShopUser> = {}

      if (input.username !== undefined) {
        const trimmedUsername = input.username.trim()
        if (trimmedUsername !== existing.username) {
          const taken = repos.users.getByUsername(trimmedUsername)
          if (taken && taken.id !== id) {
            throw new ValidationError(`Username '${trimmedUsername}' is already taken`)
          }
        }
        partial.username = trimmedUsername
      }
      if (input.displayName !== undefined) partial.displayName = input.displayName.trim()
      if (input.department !== undefined) partial.department = input.department
      if (input.active !== undefined) partial.active = input.active
      if (input.isAdmin !== undefined) partial.isAdmin = input.isAdmin

      return repos.users.update(id, partial)
    },

    deactivateUser(id: string): ShopUser {
      const existing = repos.users.getById(id)
      if (!existing) {
        throw new NotFoundError('User', id)
      }
      return repos.users.update(id, { active: false })
    },
  }
}

export type UserService = ReturnType<typeof createUserService>
