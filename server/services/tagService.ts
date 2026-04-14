import type { TagRepository } from '../repositories/interfaces/tagRepository'
import type { JobTagRepository } from '../repositories/interfaces/jobTagRepository'
import type { Tag } from '../types/domain'
import type { CreateTagInput, UpdateTagInput } from '../types/api'
import { generateId } from '../utils/idGenerator'
import { assertNonEmpty } from '../utils/validation'
import { ValidationError, NotFoundError } from '../utils/errors'

const COLOR_REGEX = /^#[0-9a-fA-F]{6}$/
const DEFAULT_COLOR = '#8b5cf6'

export function createTagService(repos: { tags: TagRepository, jobTags: JobTagRepository }) {
  return {
    listTags(): Tag[] {
      return repos.tags.list()
    },

    createTag(input: CreateTagInput): Tag {
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

    updateTag(id: string, input: UpdateTagInput): Tag {
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

    deleteTag(id: string): void {
      const existing = repos.tags.getById(id)
      if (!existing) {
        throw new NotFoundError('Tag', id)
      }

      repos.tags.delete(id)
    },

    getTagsByJobId(jobId: string): Tag[] {
      return repos.jobTags.getTagsByJobId(jobId)
    },
  }
}

export type TagService = ReturnType<typeof createTagService>
