import type { Tag } from '../../types/domain'

export interface TagRepository {
  list(): Tag[]
  getById(id: string): Tag | null
  getByIds(ids: string[]): Tag[]
  create(tag: Tag): Tag
  update(id: string, partial: Partial<Tag>): Tag
  delete(id: string): boolean
  findByName(name: string): Tag | null
}
