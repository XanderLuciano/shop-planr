import type { TagRepository } from '../repositories/interfaces/tagRepository'
import type { JobTagRepository } from '../repositories/interfaces/jobTagRepository'
import type { JobRepository } from '../repositories/interfaces/jobRepository'
import type { UserRepository } from '../repositories/interfaces/userRepository'
import type { AuditService } from './auditService'
import type { Tag } from '../types/domain'
import type { CreateTagInput, UpdateTagInput } from '../types/api'
import { generateId } from '../utils/idGenerator'
import { assertNonEmpty } from '../utils/validation'
import { ValidationError, NotFoundError } from '../utils/errors'
import { requireAdmin } from '../utils/auth'
import { TAG_NAME_MAX, HEX_COLOR_REGEX, DEFAULT_TAG_COLOR } from '../constants/tag'

export function createTagService(
  repos: {
    tags: TagRepository
    jobTags: JobTagRepository
    jobs: JobRepository
    users: UserRepository
  },
  auditService: AuditService,
) {
  return {
    listTags(): Tag[] {
      return repos.tags.list()
    },

    createTag(userId: string, input: CreateTagInput): Tag {
      requireAdmin(repos.users, userId, 'create tags')
      assertNonEmpty(input.name, 'name')
      const trimmed = input.name.trim()

      if (trimmed.length > TAG_NAME_MAX) {
        throw new ValidationError(`Tag name must be ${TAG_NAME_MAX} characters or fewer`)
      }

      const color = input.color ?? DEFAULT_TAG_COLOR
      if (!HEX_COLOR_REGEX.test(color)) {
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

      const created = repos.tags.create(tag)
      auditService.recordTagCreation({
        userId,
        tagId: created.id,
        metadata: { tagName: created.name, color: created.color },
      })
      return created
    },

    updateTag(userId: string, id: string, input: UpdateTagInput): Tag {
      requireAdmin(repos.users, userId, 'update tags')
      const existing = repos.tags.getById(id)
      if (!existing) {
        throw new NotFoundError('Tag', id)
      }

      const partial: Partial<Tag> = {}
      const changes: { name?: { from: string, to: string }, color?: { from: string, to: string } } = {}

      if (input.name !== undefined) {
        assertNonEmpty(input.name, 'name')
        const trimmed = input.name.trim()

        if (trimmed.length > TAG_NAME_MAX) {
          throw new ValidationError(`Tag name must be ${TAG_NAME_MAX} characters or fewer`)
        }

        const duplicate = repos.tags.findByName(trimmed)
        if (duplicate && duplicate.id !== existing.id) {
          throw new ValidationError('A tag with this name already exists')
        }

        if (trimmed !== existing.name) {
          partial.name = trimmed
          changes.name = { from: existing.name, to: trimmed }
        }
      }

      if (input.color !== undefined) {
        if (!HEX_COLOR_REGEX.test(input.color)) {
          throw new ValidationError('Color must be a valid hex color (e.g. #ef4444)')
        }
        if (input.color !== existing.color) {
          partial.color = input.color
          changes.color = { from: existing.color, to: input.color }
        }
      }

      // Short-circuit: nothing actually changed — return existing without touching DB
      if (!changes.name && !changes.color) {
        return existing
      }

      partial.updatedAt = new Date().toISOString()
      const updated = repos.tags.update(id, partial)

      auditService.recordTagUpdate({
        userId,
        tagId: updated.id,
        metadata: { tagName: updated.name, changes },
      })

      return updated
    },

    /**
     * Deletes a tag. If the tag is currently assigned to jobs, the caller must
     * opt in with `force=true` — the assignments will be cascaded away via the
     * FK constraint and an audit entry will record the affected job IDs so
     * the removal is recoverable in principle.
     *
     * Throws a `ValidationError` with `code: 'TAG_IN_USE'` and
     * `meta.affectedJobCount` when the tag is assigned and `force` is false.
     */
    deleteTag(userId: string, id: string, force = false): void {
      requireAdmin(repos.users, userId, 'delete tags')
      const existing = repos.tags.getById(id)
      if (!existing) {
        throw new NotFoundError('Tag', id)
      }

      const affectedJobIds = repos.jobTags.getJobIdsByTagId(id)
      if (affectedJobIds.length > 0 && !force) {
        throw new ValidationError(
          `Tag is assigned to ${affectedJobIds.length} job(s). Pass force=true to remove it from all jobs.`,
          { code: 'TAG_IN_USE', meta: { affectedJobCount: affectedJobIds.length } },
        )
      }

      repos.tags.delete(id)
      // Audit only after the delete succeeds — if the delete throws we leave
      // no orphan audit row describing a deletion that never happened.
      auditService.recordTagDeletion({
        userId,
        tagId: id,
        metadata: {
          tagName: existing.name,
          affectedJobIds,
          affectedJobCount: affectedJobIds.length,
        },
      })
    },

    getTagsByJobId(jobId: string): Tag[] {
      const job = repos.jobs.getById(jobId)
      if (!job) {
        throw new NotFoundError('Job', jobId)
      }
      return repos.jobTags.getTagsByJobId(jobId)
    },
  }
}

export type TagService = ReturnType<typeof createTagService>
