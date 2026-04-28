/**
 * Zod schemas for Jira API endpoints.
 *
 * These schemas validate request bodies at the API boundary,
 * ensuring services receive correctly-typed inputs.
 */
import { z } from 'zod'

export const linkJiraTicketSchema = z.object({
  ticketKey: z.string().min(1, 'ticketKey is required'),
  goalQuantity: z.number().int().positive('goalQuantity must be a positive integer').optional(),
  templateId: z.string().min(1).optional(),
})

export const jiraPushSchema = z.object({
  jobId: z.string().min(1, 'jobId is required'),
})
