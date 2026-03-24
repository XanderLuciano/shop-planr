/**
 * API input/output types for SHOP_ERP.
 *
 * These types define the shape of request bodies sent to API routes.
 * API routes parse incoming data into these types before delegating to services.
 */

import type { ScrapReason } from './domain'

// ---- Job ----

export interface CreateJobInput {
  name: string
  goalQuantity: number
  jiraTicketKey?: string
  jiraTicketSummary?: string
  jiraPartNumber?: string
  jiraPriority?: string
  jiraEpicLink?: string
  jiraLabels?: string[]
}

export interface UpdateJobInput {
  name?: string
  goalQuantity?: number
}

// ---- Path ----

export interface CreatePathInput {
  jobId: string
  name: string
  goalQuantity: number
  advancementMode?: 'strict' | 'flexible' | 'per_step'
  steps: { name: string, location?: string, optional?: boolean, dependencyType?: 'physical' | 'preferred' | 'completion_gate' }[]
}

export interface UpdatePathInput {
  name?: string
  goalQuantity?: number
  advancementMode?: 'strict' | 'flexible' | 'per_step'
  steps?: { name: string, location?: string, optional?: boolean, dependencyType?: 'physical' | 'preferred' | 'completion_gate' }[]
}

// ---- Serial Numbers ----

export interface BatchCreateSerialsInput {
  jobId: string
  pathId: string
  quantity: number
  certId?: string
}

export interface AdvanceSerialInput {
  userId: string
}

export interface AttachCertInput {
  certId: string
  userId: string
}

// ---- Certificate ----

export interface CreateCertInput {
  type: 'material' | 'process'
  name: string
  metadata?: Record<string, unknown>
}

export interface BatchAttachCertInput {
  certId: string
  serialIds: string[]
  userId: string
}

// ---- Template ----

export interface CreateTemplateInput {
  name: string
  steps: { name: string, location?: string }[]
}

export interface ApplyTemplateInput {
  jobId: string
  pathName?: string
  goalQuantity: number
}

// ---- BOM ----

export interface CreateBomInput {
  name: string
  entries: {
    partType: string
    requiredQuantityPerBuild: number
    contributingJobIds: string[]
  }[]
}

// ---- Step Assignment ----

export interface AssignStepInput {
  userId: string | null
}

// ---- Jira ----

export interface LinkJiraInput {
  ticketKey: string
  templateId?: string
  goalQuantity?: number
}

export interface PushToJiraInput {
  jobId: string
  mode: 'description_table' | 'comment_summary'
}

export interface PushNoteToJiraInput {
  noteId: string
}

// ---- Lifecycle ----

export interface ScrapSerialInput {
  reason: ScrapReason
  explanation?: string // required when reason = 'other'
  userId: string
}

export interface ForceCompleteInput {
  reason?: string
  userId: string
}

export interface AdvanceToStepInput {
  targetStepIndex: number
  userId: string
}

export interface CompleteDeferredStepInput {
  userId: string
}

export interface WaiveStepInput {
  reason: string
  approverId: string
}

export interface CreateStepOverrideInput {
  serialIds: string[]
  stepId: string
  reason: string
  userId: string
}

// ---- BOM Edit ----

export interface EditBomInput {
  entries: { partType: string; requiredQuantityPerBuild: number; contributingJobIds: string[] }[]
  changeDescription: string
  userId: string
}

// ---- Path Advancement Mode ----

export interface UpdateAdvancementModeInput {
  advancementMode: 'strict' | 'flexible' | 'per_step'
}

// ---- Library ----

export interface CreateLibraryEntryInput {
  name: string
}
