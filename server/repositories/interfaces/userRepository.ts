import type { ShopUser } from '../../types/domain'

export interface UserRepository {
  create(user: ShopUser): ShopUser
  getById(id: string): ShopUser | null
  list(): ShopUser[]
  listActive(): ShopUser[]
  update(id: string, partial: Partial<ShopUser>): ShopUser
}
