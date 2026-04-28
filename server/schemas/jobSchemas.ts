/**
 * Zod schemas for job API endpoints.
 *
 * These schemas validate request inputs at the API boundary, ensuring services
 * receive correctly-typed inputs.
 */
import { z } from 'zod'

export const createJobSchema = z.object({
  name: z.string().min(1, 'name is required'),
  goalQuantity: z.number().int().positive('goalQuantity must be a positive integer'),
  jiraTicketKey: z.string().optional(),
  jiraTicketSummary: z.string().optional(),
  jiraPartNumber: z.string().optional(),
  jiraPriority: z.string().optional(),
  jiraEpicLink: z.string().optional(),
  jiraLabels: z.array(z.string()).optional(),
})

export const updateJobSchema = z.object({
  name: z.string().min(1).optional(),
  goalQuantity: z.number().int().positive('goalQuantity must be a positive integer').optional(),
})

export const updatePrioritiesSchema = z.object({
  priorities: z.array(z.object({
    jobId: z.string().min(1, 'jobId is required'),
    priority: z.number().int().positive('priority must be a positive integer'),
  })).min(1, 'At least one priority entry is required'),
})
