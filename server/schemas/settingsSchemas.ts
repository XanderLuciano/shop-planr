/**
 * Zod schemas for settings API endpoints.
 *
 * These schemas validate request inputs at the API boundary, ensuring services
 * receive correctly-typed inputs.
 */
import { z } from 'zod'

const jiraConnectionSchema = z.object({
  baseUrl: z.string().optional(),
  projectKey: z.string().optional(),
  username: z.string().optional(),
  apiToken: z.string().optional(),
  enabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
})

const jiraFieldMappingSchema = z.object({
  id: z.string().min(1),
  jiraFieldId: z.string().min(1),
  label: z.string().min(1),
  shopErpField: z.string().min(1),
  isDefault: z.boolean(),
})

const pageTogglesSchema = z.object({
  jobs: z.boolean().optional(),
  partsBrowser: z.boolean().optional(),
  parts: z.boolean().optional(),
  queue: z.boolean().optional(),
  templates: z.boolean().optional(),
  bom: z.boolean().optional(),
  certs: z.boolean().optional(),
  jira: z.boolean().optional(),
  audit: z.boolean().optional(),
})

const n8nConnectionSchema = z.object({
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  enabled: z.boolean().optional(),
})

export const updateSettingsSchema = z.object({
  jiraConnection: jiraConnectionSchema.optional(),
  jiraFieldMappings: z.array(jiraFieldMappingSchema).optional(),
  pageToggles: pageTogglesSchema.optional(),
  n8nConnection: n8nConnectionSchema.optional(),
})

/** Shape for the ad-hoc "Test Connection" endpoint — neither field is required
 *  so the UI can pass only what the admin has filled in so far. */
export const testN8nConnectionSchema = z.object({
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
})
