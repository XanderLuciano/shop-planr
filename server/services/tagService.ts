import type { TagRepository } from '../repositories/interfaces/tagRepository'
import type { JobTagRepository } from '../repositories/interfaces/jobTagRepository'
import type { UserRepository } from '../repositories/interfaces/userRepository'
import type { AuditService } from './auditService'
import type { Tag } from '../types/domain'
import type { CreateTagInput, UpdateTagInput } from '../types/api'
import { generateId } from '../utils/idGenerator'
import { assertNonEmpty } from '../utils/validation'
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors'

const COLOR_REGEX = /^#[0-9a-fA-F]{6}$/
const DEFAULT_COLOR = '#8b5cf6'

export function createTagService(
  repos: {
    tags: TagRepository
    jobTags: JobTagRepository
    users: UserRepository
  },
  auditService: AuditService,
) {
  function requireAdmin(userId: string, action: string): void {
    if (!userId) {
      throw new ValidationError('userId is required')
    }
    const user = repos.users.getById(userId)
    if (!user) {
      throw new ValidationError(`User not found: ${userId}`)
    }
    if (!user.isAdmin) {
      throw new ForbiddenError(`Admin access required to ${action} tags`)
    }
  }

  return {
    listTags(): Tag[] {
      return repos.tags.list()
    },

    createTag(userId: string, input: CreateTagInput): Tag {
      requireAdmin(userId, 'create')
      assertNonEmpty(input.name, 'name')
      const trimmed = input.name.trim()

      if (trimmed.length > 30) {
        throw new ValidationError('Tag name must be 30 characters or fewer')
      }

      const color = input.color ?? DEFAULT_COLOR
      if (!COLOR_REGEX.test(color)) {
        throw new ValidationError('Color must be a valid hex color (e.g. #ef4444)')
      }

      const existing = repos.tags.findByName(trimmed)
      if (existing) {
        throw new ValidationError('A tag with this name already exists')
      }

      const now = new Date().toISOString()
      const tag: Tag = {
        id: generateId('tag'),
        name: trimmed,
        color,
        createdAt: now,
        updatedAt: now,
      }

      return repos.tags.create(tag)
    },

    updateTag(userId: string, id: string, input: UpdateTagInput): Tag {
      requireAdmin(userId, 'update')
      const existing = repos.tags.getById(id)
      if (!existing) {
        throw new NotFoundError('Tag', id)
      }

      const partial: Partial<Tag> = {}

      if (input.name !== undefined) {
        assertNonEmpty(input.name, 'name')
        const trimmed = input.name.trim()

        if (trimmed.length > 30) {
          throw new ValidationError('Tag name must be 30 characters or fewer')
        }

        const duplicate = repos.tags.findByName(trimmed)
        if (duplicate && duplicate.id !== existing.id) {
          throw new ValidationError('A tag with this name already exists')
        }

        partial.name = trimmed
      }

      if (input.color !== undefined) {
        if (!COLOR_REGEX.test(input.color)) {
          throw new ValidationError('Color must be a valid hex color (e.g. #ef4444)')
        }
        partial.color = input.color
      }

      partial.updatedAt = new Date().toISOString()

      return repos.tags.update(id, partial)
    },

    /**
     * Deletes a tag. If the tag is currently assigned to jobs, the caller must
     * opt in with `force=true` — the assignments will be cascaded away via the
     * FK constraint and an audit entry will record the affected job IDs so
     * the removal is recoverable in principle.
     */
    deleteTag(userId: string, id: string, options: { force?: boolean } = {}): void {
      requireAdmin(userId, 'delete')
      const existing = repos.tags.getById(id)
      if (!existing) {
        throw new NotFoundError('Tag', id)
      }

      const affectedJobIds = repos.jobTags.getJobIdsByTagId(id)
      if (affectedJobIds.length > 0 && !options.force) {
        throw new ValidationError(
          `Tag is assigned to ${affectedJobIds.length} job(s). Pass force=true to remove it from all jobs.`,
        )
      }

      auditService.recordTagDeletion({
        userId,
        tagId: id,
        metadata: {
          tagName: existing.name,
          affectedJobIds,
          affectedJobCount: affectedJobIds.length,
        },
      })

      repos.tags.delete(id)
    },

    getTagsByJobId(jobId: string): Tag[] {
      return repos.jobTags.getTagsByJobId(jobId)
    },
  }
}

export type TagService = ReturnType<typeof createTagService>
