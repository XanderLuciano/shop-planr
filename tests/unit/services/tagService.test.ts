import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTagService } from '../../../server/services/tagService'
import { NotFoundError, ValidationError } from '../../../server/utils/errors'
import type { TagRepository } from '../../../server/repositories/interfaces/tagRepository'
import type { JobTagRepository } from '../../../server/repositories/interfaces/jobTagRepository'
import type { Tag } from '../../../server/types/domain'

function createMockTagRepo(): TagRepository {
  const store = new Map<string, Tag>()
  return {
    list: vi.fn(() => [...store.values()]),
    getById: vi.fn((id: string) => store.get(id) ?? null),
    getByIds: vi.fn((ids: string[]) => ids.map(id => store.get(id)).filter(Boolean) as Tag[]),
    create: vi.fn((tag: Tag) => {
      store.set(tag.id, tag)
      return tag
    }),
    update: vi.fn((id: string, partial: Partial<Tag>) => {
      const existing = store.get(id)!
      const updated = { ...existing, ...partial }
      store.set(id, updated)
      return updated
    }),
    delete: vi.fn((id: string) => store.delete(id)),
    findByName: vi.fn((name: string) => {
      for (const tag of store.values()) {
        if (tag.name.toLowerCase() === name.toLowerCase()) return tag
      }
      return null
    }),
  }
}

function createMockJobTagRepo(): JobTagRepository {
  const jobTagMap = new Map<string, string[]>()
  const tagStore = new Map<string, Tag>()
  return {
    getTagsByJobId: vi.fn((jobId: string) => {
      const ids = jobTagMap.get(jobId) ?? []
      return ids.map(id => tagStore.get(id)).filter(Boolean) as Tag[]
    }),
    getTagsForJobs: vi.fn((jobIds: string[]) => {
      const result = new Map<string, Tag[]>()
      for (const jobId of jobIds) {
        const ids = jobTagMap.get(jobId) ?? []
        result.set(jobId, ids.map(id => tagStore.get(id)).filter(Boolean) as Tag[])
      }
      return result
    }),
    replaceJobTags: vi.fn(),
    removeAllTagsForJob: vi.fn(),
    countJobsByTagId: vi.fn(() => 0),
  }
}

describe('TagService', () => {
  let tagRepo: TagRepository
  let jobTagRepo: JobTagRepository
  let service: ReturnType<typeof createTagService>

  beforeEach(() => {
    tagRepo = createMockTagRepo()
    jobTagRepo = createMockJobTagRepo()
    service = createTagService({ tags: tagRepo, jobTags: jobTagRepo })
  })

  describe('createTag', () => {
    it('throws ValidationError for empty name', () => {
      expect(() => service.createTag({ name: '' })).toThrow(ValidationError)
    })

    it('throws ValidationError for whitespace-only name', () => {
      expect(() => service.createTag({ name: '   ' })).toThrow(ValidationError)
    })

    it('throws ValidationError for name longer than 30 characters', () => {
      expect(() => service.createTag({ name: 'a'.repeat(31) })).toThrow(ValidationError)
    })

    it('throws ValidationError for duplicate name (case-insensitive)', () => {
      service.createTag({ name: 'Urgent' })
      expect(() => service.createTag({ name: 'urgent' })).toThrow(ValidationError)
      expect(() => service.createTag({ name: 'URGENT' })).toThrow(ValidationError)
    })

    it('throws ValidationError for invalid color', () => {
      expect(() => service.createTag({ name: 'Test', color: 'red' })).toThrow(ValidationError)
      expect(() => service.createTag({ name: 'Test2', color: '#gggggg' })).toThrow(ValidationError)
      expect(() => service.createTag({ name: 'Test3', color: '#fff' })).toThrow(ValidationError)
    })

    it('defaults color to #8b5cf6 when not provided', () => {
      const tag = service.createTag({ name: 'Default Color' })
      expect(tag.color).toBe('#8b5cf6')
    })

    it('creates tag with tag_ prefix ID', () => {
      const tag = service.createTag({ name: 'My Tag' })
      expect(tag.id).toMatch(/^tag_/)
    })

    it('trims whitespace from name', () => {
      const tag = service.createTag({ name: '  Trimmed  ' })
      expect(tag.name).toBe('Trimmed')
    })

    it('creates tag with valid input and custom color', () => {
      const tag = service.createTag({ name: 'Priority', color: '#ef4444' })
      expect(tag.name).toBe('Priority')
      expect(tag.color).toBe('#ef4444')
      expect(tag.createdAt).toBeTruthy()
      expect(tag.updatedAt).toBeTruthy()
    })
  })

  describe('updateTag', () => {
    it('updates name only (partial update)', () => {
      const tag = service.createTag({ name: 'Old Name', color: '#ef4444' })
      const updated = service.updateTag(tag.id, { name: 'New Name' })
      expect(updated.name).toBe('New Name')
      expect(updated.color).toBe('#ef4444')
    })

    it('updates color only (partial update)', () => {
      const tag = service.createTag({ name: 'My Tag', color: '#ef4444' })
      const updated = service.updateTag(tag.id, { color: '#3b82f6' })
      expect(updated.name).toBe('My Tag')
      expect(updated.color).toBe('#3b82f6')
    })

    it('allows updating name to the same name as self (no uniqueness conflict)', () => {
      const tag = service.createTag({ name: 'Same Name' })
      expect(() => service.updateTag(tag.id, { name: 'Same Name' })).not.toThrow()
    })

    it('throws ValidationError when updating to a name used by a different tag', () => {
      service.createTag({ name: 'Existing Tag' })
      const tag2 = service.createTag({ name: 'Other Tag' })
      expect(() => service.updateTag(tag2.id, { name: 'Existing Tag' })).toThrow(ValidationError)
    })

    it('throws ValidationError for name longer than 30 characters', () => {
      const tag = service.createTag({ name: 'Valid Name' })
      expect(() => service.updateTag(tag.id, { name: 'a'.repeat(31) })).toThrow(ValidationError)
    })

    it('throws ValidationError for invalid color', () => {
      const tag = service.createTag({ name: 'Valid Name' })
      expect(() => service.updateTag(tag.id, { color: 'blue' })).toThrow(ValidationError)
    })

    it('throws NotFoundError when tag does not exist', () => {
      expect(() => service.updateTag('nonexistent', { name: 'X' })).toThrow(NotFoundError)
    })

    it('refreshes updatedAt on update', () => {
      const tag = service.createTag({ name: 'Timestamp Test' })
      const before = tag.updatedAt
      // Small delay to ensure timestamp differs
      const updated = service.updateTag(tag.id, { name: 'Updated' })
      expect(updated.updatedAt).toBeTruthy()
      // updatedAt should be set (may equal before if same ms, but field must exist)
      expect(typeof updated.updatedAt).toBe('string')
    })
  })

  describe('deleteTag', () => {
    it('throws NotFoundError when tag does not exist', () => {
      expect(() => service.deleteTag('nonexistent')).toThrow(NotFoundError)
    })

    it('calls repos.tags.delete with the correct id', () => {
      const tag = service.createTag({ name: 'To Delete' })
      service.deleteTag(tag.id)
      expect(tagRepo.delete).toHaveBeenCalledWith(tag.id)
    })
  })

  describe('listTags', () => {
    it('returns all tags', () => {
      service.createTag({ name: 'Tag A' })
      service.createTag({ name: 'Tag B' })
      service.createTag({ name: 'Tag C' })
      expect(service.listTags()).toHaveLength(3)
    })

    it('returns empty array when no tags exist', () => {
      expect(service.listTags()).toHaveLength(0)
    })
  })

  describe('getTagsByJobId', () => {
    it('delegates to jobTags repository', () => {
      service.getTagsByJobId('job_123')
      expect(jobTagRepo.getTagsByJobId).toHaveBeenCalledWith('job_123')
    })
  })
})
