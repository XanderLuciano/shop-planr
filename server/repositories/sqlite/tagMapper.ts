import type { Tag } from '../../types/domain'

export interface TagRow {
  id: string
  name: string
  color: string
  created_at: string
  updated_at: string
}

export function rowToTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
