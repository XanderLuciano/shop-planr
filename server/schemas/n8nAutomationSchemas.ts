import { z } from 'zod'
import { requiredId } from './_primitives'
import { WEBHOOK_EVENT_TYPES } from '../types/domain'

const webhookEventTypeEnum = z.enum(WEBHOOK_EVENT_TYPES)

/** Schema for a single n8n node */
const n8nNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  typeVersion: z.number().int().min(1),
  position: z.tuple([z.number(), z.number()]),
  parameters: z.record(z.string(), z.unknown()),
})

/** Schema for the n8n workflow definition */
const n8nWorkflowDefinitionSchema = z.object({
  nodes: z.array(n8nNodeSchema),
  connections: z.record(z.string(), z.unknown()),
  settings: z.record(z.string(), z.unknown()).optional(),
})

/** Create a new automation */
export const createN8nAutomationSchema = z.object({
  name: z.string().min(1).max(100).describe('Human-readable name for this automation'),
  description: z.string().max(500).default(''),
  eventTypes: z.array(webhookEventTypeEnum).min(1).describe('Which Shop Planr events trigger this automation'),
  workflowJson: n8nWorkflowDefinitionSchema.describe('The n8n workflow definition'),
  enabled: z.boolean().default(false),
})

/** Update an existing automation */
export const updateN8nAutomationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  eventTypes: z.array(webhookEventTypeEnum).min(1).optional(),
  workflowJson: n8nWorkflowDefinitionSchema.optional(),
  enabled: z.boolean().optional(),
})

/** Deploy/sync an automation to the n8n instance */
export const deployN8nAutomationSchema = z.object({
  automationId: requiredId,
})
