/**
 * Zod schemas for job API endpoints.
 *
 * These schemas validate request inputs at the API boundary, ensuring services
 * receive correctly-typed inputs.
 */
import { z } from 'zod'
import { requiredId, positiveInt } from './_primitives'

export const createJobSchema = z.object({
  name: z.string().min(1, 'name is required'),
  goalQuantity: positiveInt,
  jiraTicketKey: z.string().optional(),
  jiraTicketSummary: z.string().optional(),
  jiraPartNumber: z.string().optional(),
  jiraPriority: z.string().optional(),
  jiraEpicLink: z.string().optional(),
  jiraLabels: z.array(z.string()).optional(),
})

export const updateJobSchema = z.object({
  name: z.string().min(1).optional(),
  goalQuantity: positiveInt.optional(),
})

export const updatePrioritiesSchema = z.object({
  priorities: z.array(z.object({
    jobId: requiredId,
    priority: positiveInt,
  })).min(1, 'At least one priority entry is required'),
})
