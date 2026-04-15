import type { UserRepository } from '../repositories/interfaces/userRepository'
import type { ShopUser } from '../types/domain'
import { ValidationError, ForbiddenError } from './errors'

/**
 * Asserts that the caller identified by `userId` exists and has admin
 * privileges. Returns the resolved `ShopUser` so callers can use other
 * fields (e.g., `username`) without a second lookup.
 *
 * Throws:
 *   - `ValidationError` if `userId` is empty or the user does not exist
 *   - `ForbiddenError` if the user exists but `isAdmin` is false
 *
 * `action` is a short verb phrase ("delete tags", "delete parts") used
 * in the `ForbiddenError` message so the caller gets a specific hint.
 */
export function requireAdmin(
  users: UserRepository | undefined,
  userId: string,
  action: string,
): ShopUser {
  if (!userId) {
    throw new ValidationError('userId is required')
  }
  if (!users) {
    throw new ValidationError('User repository not available')
  }
  const user = users.getById(userId)
  if (!user) {
    throw new ValidationError(`User not found: ${userId}`)
  }
  if (!user.isAdmin) {
    throw new ForbiddenError(`Admin access required to ${action}`)
  }
  return user
}
