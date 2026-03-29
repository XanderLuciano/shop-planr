import type Database from 'better-sqlite3'
import type { ShopUser } from '../../types/domain'
import type { UserRepository } from '../interfaces/userRepository'
import { NotFoundError } from '../../utils/errors'

interface UserRow {
  id: string
  name: string
  department: string | null
  active: number
  created_at: string
}

function rowToDomain(row: UserRow): ShopUser {
  return {
    id: row.id,
    name: row.name,
    department: row.department ?? undefined,
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
    this.db
      .prepare(
        `
      INSERT INTO users (id, name, department, active, created_at)
      VALUES (?, ?, ?, ?, ?)
    `
      )
      .run(user.id, user.name, user.department ?? null, user.active ? 1 : 0, user.createdAt)
    return user
  }

  getById(id: string): ShopUser | null {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
    return row ? rowToDomain(row) : null
  }

  list(): ShopUser[] {
    const rows = this.db.prepare('SELECT * FROM users ORDER BY name').all() as UserRow[]
    return rows.map(rowToDomain)
  }

  listActive(): ShopUser[] {
    const rows = this.db
      .prepare('SELECT * FROM users WHERE active = 1 ORDER BY name')
      .all() as UserRow[]
    return rows.map(rowToDomain)
  }

  update(id: string, partial: Partial<ShopUser>): ShopUser {
    const existing = this.getById(id)
    if (!existing) throw new NotFoundError('User', id)

    const updated: ShopUser = { ...existing, ...partial, id }

    this.db
      .prepare(
        `
      UPDATE users SET name = ?, department = ?, active = ?
      WHERE id = ?
    `
      )
      .run(updated.name, updated.department ?? null, updated.active ? 1 : 0, id)
    return updated
  }
}
