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
  jiraLabels?: readonly string[]
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
  steps: { name: string, location?: string, assignedTo?: string | null, optional?: boolean, dependencyType?: 'physical' | 'preferred' | 'completion_gate' }[]
}

export interface UpdatePathInput {
  name?: string
  goalQuantity?: number
  advancementMode?: 'strict' | 'flexible' | 'per_step'
  steps?: { id?: string, name: string, location?: string, optional?: boolean, dependencyType?: 'physical' | 'preferred' | 'completion_gate' }[]
}

export interface BatchPathOperationsInput {
  jobId: string
  userId: string
  create: Omit<CreatePathInput, 'jobId'>[]
  update: { pathId: string, name?: string, goalQuantity?: number, advancementMode?: 'strict' | 'flexible' | 'per_step', steps?: UpdatePathInput['steps'] }[]
  delete: string[]
}

export interface BatchPathOperationsResult {
  created: import('./domain').Path[]
  updated: import('./domain').Path[]
  deleted: string[]
}

// ---- Parts (formerly Serial Numbers) ----

export interface BatchCreatePartsInput {
  jobId: string
  pathId: string
  quantity: number
  certId?: string
}

/** @deprecated Use `BatchCreatePartsInput` instead. Backward-compatible alias. */
export type BatchCreateSerialsInput = BatchCreatePartsInput

export interface AdvancePartInput {
  userId: string
}

/** @deprecated Use `AdvancePartInput` instead. Backward-compatible alias. */
export type AdvanceSerialInput = AdvancePartInput

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
  partIds: readonly string[]
  userId: string
}

/** @deprecated Use `partIds` field. Backward-compatible alias type. */
export type BatchAttachCertInputLegacy = BatchAttachCertInput

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
    contributingJobIds: readonly string[]
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

export interface ScrapPartInput {
  reason: ScrapReason
  explanation?: string // required when reason = 'other'
  userId: string
}

/** @deprecated Use `ScrapPartInput` instead. Backward-compatible alias. */
export type ScrapSerialInput = ScrapPartInput

export interface ForceCompleteInput {
  reason?: string
  userId: string
}

export interface AdvanceToStepInput {
  targetStepId: string
  userId: string
  skip?: boolean // when true, origin step is marked 'skipped' (optional/overridden) or 'deferred' (required)
}

export interface CompleteDeferredStepInput {
  userId: string
}

export interface WaiveStepInput {
  reason: string
  approverId: string
}

export interface CreateStepOverrideInput {
  partIds: readonly string[]
  stepId: string
  reason: string
  userId: string
}

// ---- BOM Edit ----

export interface EditBomInput {
  name?: string
  entries: { partType: string, requiredQuantityPerBuild: number, contributingJobIds: readonly string[] }[]
  changeDescription: string
  userId: string
}

// ---- Path Advancement Mode ----

export interface UpdateAdvancementModeInput {
  advancementMode: 'strict' | 'flexible' | 'per_step'
}

// ---- Job Priority ----

export interface UpdatePrioritiesInput {
  priorities: { jobId: string, priority: number }[]
}

// ---- Library ----

export interface CreateLibraryEntryInput {
  name: string
}

// ---- Tag ----

export interface CreateTagInput {
  name: string
  color?: string
}

export interface UpdateTagInput {
  name?: string
  color?: string
}

export interface SetJobTagsInput {
  tagIds: string[]
}
