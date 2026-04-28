/**
 * Zod schemas for Jira API endpoints.
 *
 * These schemas validate request bodies at the API boundary,
 * ensuring services receive correctly-typed inputs.
 */
import { z } from 'zod'
import { requiredId, positiveInt } from './_primitives'

export const pushJiraCommentSchema = z.object({
  jobId: requiredId,
  noteId: requiredId.optional(),
})

export const linkJiraTicketSchema = z.object({
  ticketKey: z.string().min(1, 'ticketKey is required'),
  goalQuantity: positiveInt.optional(),
  templateId: requiredId.optional(),
})

export const jiraPushSchema = z.object({
  jobId: requiredId,
})
