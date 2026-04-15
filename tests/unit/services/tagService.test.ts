import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTagService } from '../../../server/services/tagService'
import { NotFoundError, ValidationError, ForbiddenError } from '../../../server/utils/errors'
import type { TagRepository } from '../../../server/repositories/interfaces/tagRepository'
import type { JobTagRepository } from '../../../server/repositories/interfaces/jobTagRepository'
import type { UserRepository } from '../../../server/repositories/interfaces/userRepository'
import type { Tag, ShopUser } from '../../../server/types/domain'
import type { AuditService } from '../../../server/services/auditService'

const ADMIN_ID = 'user_admin'
const REGULAR_ID = 'user_regular'

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

function createMockJobTagRepo(overrides: Partial<JobTagRepository> = {}): JobTagRepository {
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
    getJobIdsByTagId: vi.fn(() => []),
    ...overrides,
  }
}

function createMockUserRepo(): UserRepository {
  const now = '2024-01-01T00:00:00.000Z'
  const users = new Map<string, ShopUser>([
    [ADMIN_ID, { id: ADMIN_ID, username: 'admin', displayName: 'Admin', isAdmin: true, active: true, createdAt: now, pinHash: null }],
    [REGULAR_ID, { id: REGULAR_ID, username: 'reg', displayName: 'Regular', isAdmin: false, active: true, createdAt: now, pinHash: null }],
  ])
  return {
    getById: vi.fn((id: string) => users.get(id) ?? null),
    getByUsername: vi.fn(),
    list: vi.fn(() => [...users.values()]),
    listActive: vi.fn(() => [...users.values()].filter(u => u.active)),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as UserRepository
}

function createMockAuditService(): AuditService {
  return {
    recordTagCreation: vi.fn(() => ({ id: 'aud_c' })),
    recordTagUpdate: vi.fn(() => ({ id: 'aud_u' })),
    recordTagDeletion: vi.fn(() => ({ id: 'aud_d' })),
  } as unknown as AuditService
}

describe('TagService', () => {
  let tagRepo: TagRepository
  let jobTagRepo: JobTagRepository
  let userRepo: UserRepository
  let auditService: AuditService
  let service: ReturnType<typeof createTagService>

  beforeEach(() => {
    tagRepo = createMockTagRepo()
    jobTagRepo = createMockJobTagRepo()
    userRepo = createMockUserRepo()
    auditService = createMockAuditService()
    service = createTagService({ tags: tagRepo, jobTags: jobTagRepo, users: userRepo }, auditService)
  })

  describe('admin gating', () => {
    it('rejects create with ForbiddenError for non-admin', () => {
      expect(() => service.createTag(REGULAR_ID, { name: 'Test' })).toThrow(ForbiddenError)
    })

    it('rejects update with ForbiddenError for non-admin', () => {
      const tag = service.createTag(ADMIN_ID, { name: 'Test' })
      expect(() => service.updateTag(REGULAR_ID, tag.id, { name: 'New' })).toThrow(ForbiddenError)
    })

    it('rejects delete with ForbiddenError for non-admin', () => {
      const tag = service.createTag(ADMIN_ID, { name: 'Test' })
      expect(() => service.deleteTag(REGULAR_ID, tag.id)).toThrow(ForbiddenError)
    })

    it('throws ValidationError when userId is empty', () => {
      expect(() => service.createTag('', { name: 'Test' })).toThrow(ValidationError)
    })

    it('throws ValidationError when user does not exist', () => {
      expect(() => service.createTag('user_ghost', { name: 'Test' })).toThrow(ValidationError)
    })
  })

  describe('createTag', () => {
    it('throws ValidationError for empty name', () => {
      expect(() => service.createTag(ADMIN_ID, { name: '' })).toThrow(ValidationError)
    })

    it('throws ValidationError for whitespace-only name', () => {
      expect(() => service.createTag(ADMIN_ID, { name: '   ' })).toThrow(ValidationError)
    })

    it('throws ValidationError for name longer than 30 characters', () => {
      expect(() => service.createTag(ADMIN_ID, { name: 'a'.repeat(31) })).toThrow(ValidationError)
    })

    it('throws ValidationError for duplicate name (case-insensitive)', () => {
      service.createTag(ADMIN_ID, { name: 'Urgent' })
      expect(() => service.createTag(ADMIN_ID, { name: 'urgent' })).toThrow(ValidationError)
      expect(() => service.createTag(ADMIN_ID, { name: 'URGENT' })).toThrow(ValidationError)
    })

    it('throws ValidationError for invalid color', () => {
      expect(() => service.createTag(ADMIN_ID, { name: 'Test', color: 'red' })).toThrow(ValidationError)
      expect(() => service.createTag(ADMIN_ID, { name: 'Test2', color: '#gggggg' })).toThrow(ValidationError)
      expect(() => service.createTag(ADMIN_ID, { name: 'Test3', color: '#fff' })).toThrow(ValidationError)
    })

    it('defaults color to #8b5cf6 when not provided', () => {
      const tag = service.createTag(ADMIN_ID, { name: 'Default Color' })
      expect(tag.color).toBe('#8b5cf6')
    })

    it('creates tag with tag_ prefix ID', () => {
      const tag = service.createTag(ADMIN_ID, { name: 'My Tag' })
      expect(tag.id).toMatch(/^tag_/)
    })

    it('trims whitespace from name', () => {
      const tag = service.createTag(ADMIN_ID, { name: '  Trimmed  ' })
      expect(tag.name).toBe('Trimmed')
    })

    it('creates tag with valid input and custom color', () => {
      const tag = service.createTag(ADMIN_ID, { name: 'Priority', color: '#ef4444' })
      expect(tag.name).toBe('Priority')
      expect(tag.color).toBe('#ef4444')
      expect(tag.createdAt).toBeTruthy()
      expect(tag.updatedAt).toBeTruthy()
    })
  })

  describe('updateTag', () => {
    it('updates name only (partial update)', () => {
      const tag = service.createTag(ADMIN_ID, { name: 'Old Name', color: '#ef4444' })
      const updated = service.updateTag(ADMIN_ID, tag.id, { name: 'New Name' })
      expect(updated.name).toBe('New Name')
      expect(updated.color).toBe('#ef4444')
    })

    it('updates color only (partial update)', () => {
      const tag = service.createTag(ADMIN_ID, { name: 'My Tag', color: '#ef4444' })
      const updated = service.updateTag(ADMIN_ID, tag.id, { color: '#3b82f6' })
      expect(updated.name).toBe('My Tag')
      expect(updated.color).toBe('#3b82f6')
    })

    it('allows updating name to the same name as self (no uniqueness conflict)', () => {
      const tag = service.createTag(ADMIN_ID, { name: 'Same Name' })
      expect(() => service.updateTag(ADMIN_ID, tag.id, { name: 'Same Name' })).not.toThrow()
    })

    it('throws ValidationError when updating to a name used by a different tag', () => {
      service.createTag(ADMIN_ID, { name: 'Existing Tag' })
      const tag2 = service.createTag(ADMIN_ID, { name: 'Other Tag' })
      expect(() => service.updateTag(ADMIN_ID, tag2.id, { name: 'Existing Tag' })).toThrow(ValidationError)
    })

    it('throws ValidationError for name longer than 30 characters', () => {
      const tag = service.createTag(ADMIN_ID, { name: 'Valid Name' })
      expect(() => service.updateTag(ADMIN_ID, tag.id, { name: 'a'.repeat(31) })).toThrow(ValidationError)
    })

    it('throws ValidationError for invalid color', () => {
      const tag = service.createTag(ADMIN_ID, { name: 'Valid Name' })
      expect(() => service.updateTag(ADMIN_ID, tag.id, { color: 'blue' })).toThrow(ValidationError)
    })

    it('throws NotFoundError when tag does not exist', () => {
      expect(() => service.updateTag(ADMIN_ID, 'nonexistent', { name: 'X' })).toThrow(NotFoundError)
    })

    it('refreshes updatedAt on update', () => {
      const tag = service.createTag(ADMIN_ID, { name: 'Timestamp Test' })
      const updated = service.updateTag(ADMIN_ID, tag.id, { name: 'Updated' })
      expect(updated.updatedAt).toBeTruthy()
      expect(typeof updated.updatedAt).toBe('string')
    })
  })

  describe('deleteTag', () => {
    it('throws NotFoundError when tag does not exist', () => {
      expect(() => service.deleteTag(ADMIN_ID, 'nonexistent')).toThrow(NotFoundError)
    })

    it('calls repos.tags.delete when tag has no job assignments', () => {
      const tag = service.createTag(ADMIN_ID, { name: 'To Delete' })
      service.deleteTag(ADMIN_ID, tag.id)
      expect(tagRepo.delete).toHaveBeenCalledWith(tag.id)
    })

    it('records an audit entry with affected job ids when deleting', () => {
      const tag = service.createTag(ADMIN_ID, { name: 'Audited' })
      service.deleteTag(ADMIN_ID, tag.id)
      expect(auditService.recordTagDeletion).toHaveBeenCalledWith({
        userId: ADMIN_ID,
        tagId: tag.id,
        metadata: {
          tagName: 'Audited',
          affectedJobIds: [],
          affectedJobCount: 0,
        },
      })
    })

    it('refuses to delete a tag assigned to jobs without force=true', () => {
      jobTagRepo = createMockJobTagRepo({
        getJobIdsByTagId: vi.fn(() => ['job_1', 'job_2']),
      })
      service = createTagService(
        { tags: tagRepo, jobTags: jobTagRepo, users: userRepo },
        auditService,
      )
      const tag = service.createTag(ADMIN_ID, { name: 'In Use' })
      expect(() => service.deleteTag(ADMIN_ID, tag.id)).toThrow(ValidationError)
      expect(tagRepo.delete).not.toHaveBeenCalled()
      expect(auditService.recordTagDeletion).not.toHaveBeenCalled()
    })

    it('attaches a TAG_IN_USE code and affectedJobCount to the ValidationError', () => {
      jobTagRepo = createMockJobTagRepo({
        getJobIdsByTagId: vi.fn(() => ['job_1', 'job_2', 'job_3']),
      })
      service = createTagService(
        { tags: tagRepo, jobTags: jobTagRepo, users: userRepo },
        auditService,
      )
      const tag = service.createTag(ADMIN_ID, { name: 'In Use' })
      try {
        service.deleteTag(ADMIN_ID, tag.id)
        expect.fail('expected ValidationError')
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError)
        expect((e as ValidationError).code).toBe('TAG_IN_USE')
        expect((e as ValidationError).meta).toEqual({ affectedJobCount: 3 })
      }
    })

    it('deletes with force=true and audits the cascaded job ids', () => {
      jobTagRepo = createMockJobTagRepo({
        getJobIdsByTagId: vi.fn(() => ['job_1', 'job_2']),
      })
      service = createTagService(
        { tags: tagRepo, jobTags: jobTagRepo, users: userRepo },
        auditService,
      )
      const tag = service.createTag(ADMIN_ID, { name: 'Forced' })
      service.deleteTag(ADMIN_ID, tag.id, true)
      expect(tagRepo.delete).toHaveBeenCalledWith(tag.id)
      expect(auditService.recordTagDeletion).toHaveBeenCalledWith({
        userId: ADMIN_ID,
        tagId: tag.id,
        metadata: {
          tagName: 'Forced',
          affectedJobIds: ['job_1', 'job_2'],
          affectedJobCount: 2,
        },
      })
    })

    it('records the audit entry AFTER a successful delete, not before', () => {
      // If the delete throws, no audit entry should be written — otherwise
      // we'd leave orphan rows describing deletions that never happened.
      const failingTagRepo = createMockTagRepo()
      failingTagRepo.delete = vi.fn(() => {
        throw new Error('simulated DB failure')
      })
      const failService = createTagService(
        { tags: failingTagRepo, jobTags: jobTagRepo, users: userRepo },
        auditService,
      )
      const tag = failService.createTag(ADMIN_ID, { name: 'Fail' })
      expect(() => failService.deleteTag(ADMIN_ID, tag.id)).toThrow('simulated DB failure')
      expect(auditService.recordTagDeletion).not.toHaveBeenCalled()
    })
  })

  describe('audit trail', () => {
    it('records tag_created on create', () => {
      const tag = service.createTag(ADMIN_ID, { name: 'Audited Create', color: '#123456' })
      expect(auditService.recordTagCreation).toHaveBeenCalledWith({
        userId: ADMIN_ID,
        tagId: tag.id,
        metadata: { tagName: 'Audited Create', color: '#123456' },
      })
    })

    it('records tag_updated on a real change', () => {
      const tag = service.createTag(ADMIN_ID, { name: 'Old', color: '#ef4444' })
      service.updateTag(ADMIN_ID, tag.id, { name: 'New' })
      expect(auditService.recordTagUpdate).toHaveBeenCalledWith({
        userId: ADMIN_ID,
        tagId: tag.id,
        metadata: {
          tagName: 'New',
          changes: { name: { from: 'Old', to: 'New' } },
        },
      })
    })

    it('does not record tag_updated when nothing actually changes', () => {
      const tag = service.createTag(ADMIN_ID, { name: 'Same' })
      service.updateTag(ADMIN_ID, tag.id, { name: 'Same' })
      expect(auditService.recordTagUpdate).not.toHaveBeenCalled()
    })
  })

  describe('listTags', () => {
    it('returns all tags', () => {
      service.createTag(ADMIN_ID, { name: 'Tag A' })
      service.createTag(ADMIN_ID, { name: 'Tag B' })
      service.createTag(ADMIN_ID, { name: 'Tag C' })
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
