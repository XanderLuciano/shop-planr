/**
 * Zod schemas for tag API endpoints.
 *
 * These schemas validate request inputs at the API boundary, ensuring services
 * receive correctly-typed inputs.
 */
import { z } from 'zod'
import { TAG_NAME_MAX, JOB_TAGS_MAX, HEX_COLOR_REGEX } from '../constants/tag'

export const createTagSchema = z.object({
  name: z.string().trim().min(1).max(TAG_NAME_MAX),
  color: z.string().regex(HEX_COLOR_REGEX).optional(),
})

export const updateTagSchema = z.object({
  name: z.string().trim().min(1).max(TAG_NAME_MAX).optional(),
  color: z.string().regex(HEX_COLOR_REGEX).optional(),
})

export const setJobTagsSchema = z.object({
  tagIds: z.array(z.string().min(1)).max(JOB_TAGS_MAX),
})

/** Query-string schema for `DELETE /api/tags/:id`. `?force=true` cascades the removal. */
export const deleteTagQuerySchema = z.object({
  force: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
})
