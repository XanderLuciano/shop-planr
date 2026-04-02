import type Database from 'better-sqlite3'
import type { ShopUser } from '../../types/domain'
import type { UserRepository } from '../interfaces/userRepository'
import { NotFoundError } from '../../utils/errors'

interface UserRow {
  id: string
  username: string
  display_name: string
  department: string | null
  is_admin: number
  active: number
  created_at: string
}

function rowToDomain(row: UserRow): ShopUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    department: row.department ?? undefined,
    isAdmin: row.is_admin === 1,
    active: row.active === 1,
    createdAt: row.created_at,
  }
}

export class SQLiteUserRepository implements UserRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  create(user: ShopUser): ShopUser {
    this.db.prepare(`
      INSERT INTO users (id, username, display_name, is_admin, department, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(user.id, user.username, user.displayName, user.isAdmin ? 1 : 0, user.department ?? null, user.active ? 1 : 0, user.createdAt)
    return user
  }

  getById(id: string): ShopUser | null {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
    return row ? rowToDomain(row) : null
  }

  getByUsername(username: string): ShopUser | null {
    const row = this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined
    return row ? rowToDomain(row) : null
  }

  list(): ShopUser[] {
    const rows = this.db.prepare('SELECT * FROM users ORDER BY display_name').all() as UserRow[]
    return rows.map(rowToDomain)
  }

  listActive(): ShopUser[] {
    const rows = this.db.prepare('SELECT * FROM users WHERE active = 1 ORDER BY display_name').all() as UserRow[]
    return rows.map(rowToDomain)
  }

  update(id: string, partial: Partial<ShopUser>): ShopUser {
    const existing = this.getById(id)
    if (!existing) throw new NotFoundError('User', id)

    const updated: ShopUser = { ...existing, ...partial, id }

    this.db.prepare(`
      UPDATE users SET username = ?, display_name = ?, is_admin = ?, department = ?, active = ?
      WHERE id = ?
    `).run(updated.username, updated.displayName, updated.isAdmin ? 1 : 0, updated.department ?? null, updated.active ? 1 : 0, id)
    return updated
  }
}
