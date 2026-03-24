import type { UserRepository } from '../repositories/interfaces/userRepository'
import type { ShopUser } from '../types/domain'
import { generateId } from '../utils/idGenerator'
import { assertNonEmpty } from '../utils/validation'
import { NotFoundError } from '../utils/errors'

export function createUserService(repos: { users: UserRepository }) {
  return {
    createUser(input: { name: string, department?: string }): ShopUser {
      assertNonEmpty(input.name, 'name')
      return repos.users.create({
        id: generateId('user'),
        name: input.name.trim(),
        department: input.department,
        active: true,
        createdAt: new Date().toISOString()
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

    updateUser(id: string, input: { name?: string, department?: string, active?: boolean }): ShopUser {
      const existing = repos.users.getById(id)
      if (!existing) {
        throw new NotFoundError('User', id)
      }
      if (input.name !== undefined) {
        assertNonEmpty(input.name, 'name')
      }
      const partial: Partial<ShopUser> = {}
      if (input.name !== undefined) partial.name = input.name.trim()
      if (input.department !== undefined) partial.department = input.department
      if (input.active !== undefined) partial.active = input.active
      return repos.users.update(id, partial)
    },

    deactivateUser(id: string): ShopUser {
      const existing = repos.users.getById(id)
      if (!existing) {
        throw new NotFoundError('User', id)
      }
      return repos.users.update(id, { active: false })
    }
  }
}

export type UserService = ReturnType<typeof createUserService>
