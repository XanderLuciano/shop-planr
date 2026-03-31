/**
 * Core domain types for SHOP_ERP.
 *
 * These types represent the canonical shape of all domain objects
 * used across the service layer, repository interfaces, and API responses.
 */

// ---- Job ----

export interface Job {
  id: string
  name: string
  goalQuantity: number
  jiraTicketKey?: string
  jiraTicketSummary?: string
  jiraPartNumber?: string
  jiraPriority?: string
  jiraEpicLink?: string
  jiraLabels?: readonly string[]
  createdAt: string
  updatedAt: string
}

// ---- Path ----

export interface Path {
  id: string
  jobId: string
  name: string
  goalQuantity: number
  steps: readonly ProcessStep[]
  advancementMode: 'strict' | 'flexible' | 'per_step'
  createdAt: string
  updatedAt: string
}

// ---- Process Step ----

export interface ProcessStep {
  id: string
  name: string
  order: number
  location?: string
  assignedTo?: string
  optional: boolean
  dependencyType: 'physical' | 'preferred' | 'completion_gate'
}

// ---- Part (formerly Serial Number) ----

export type ScrapReason = 'out_of_tolerance' | 'process_defect' | 'damaged' | 'operator_error' | 'other'

export interface Part {
  id: string
  jobId: string
  pathId: string
  currentStepIndex: number
  status: 'in_progress' | 'completed' | 'scrapped'
  scrapReason?: ScrapReason
  scrapExplanation?: string
  scrapStepId?: string
  scrappedAt?: string
  scrappedBy?: string
  forceCompleted: boolean
  forceCompletedBy?: string
  forceCompletedAt?: string
  forceCompletedReason?: string
  createdAt: string
  updatedAt: string
}

/** @deprecated Use `Part` instead. Backward-compatible alias. */
export type SerialNumber = Part

// ---- Certificate ----

export interface Certificate {
  id: string
  type: 'material' | 'process'
  name: string
  metadata?: Record<string, unknown>
  createdAt: string
}

// ---- Certificate Attachment ----

export interface CertAttachment {
  id?: string
  partId: string
  certId: string
  stepId: string
  attachedAt: string
  attachedBy: string
}

// ---- Template Route ----

export interface TemplateRoute {
  id: string
  name: string
  steps: readonly TemplateStep[]
  createdAt: string
  updatedAt: string
}

export interface TemplateStep {
  name: string
  order: number
  location?: string
  optional: boolean
  dependencyType: 'physical' | 'preferred' | 'completion_gate'
}

// ---- BOM (Bill of Materials) ----

export interface BOM {
  id: string
  name: string
  entries: readonly BomEntry[]
  createdAt: string
  updatedAt: string
}

export interface BomEntry {
  id?: string
  bomId?: string
  partType: string
  requiredQuantityPerBuild: number
  contributingJobIds: readonly string[]
}

// ---- Audit Trail ----

export type AuditAction
  = | 'cert_attached'
    | 'part_created'
    | 'part_advanced'
    | 'part_completed'
    | 'note_created'
    | 'part_scrapped'
    | 'part_force_completed'
    | 'step_override_created'
    | 'step_override_reversed'
    | 'step_deferred'
    | 'step_skipped'
    | 'deferred_step_completed'
    | 'step_waived'
    | 'bom_edited'

export interface AuditEntry {
  id: string
  action: AuditAction
  userId: string
  timestamp: string
  partId?: string
  certId?: string
  jobId?: string
  pathId?: string
  stepId?: string
  fromStepId?: string
  toStepId?: string
  batchQuantity?: number
  metadata?: Record<string, unknown>
}

// ---- User (Simple / Kiosk Mode) ----

export interface ShopUser {
  id: string
  name: string
  department?: string
  active: boolean
  createdAt: string
}

// ---- Process Step Notes / Defects ----

export interface StepNote {
  id: string
  jobId: string
  pathId: string
  stepId: string
  partIds: readonly string[]
  text: string
  createdBy: string
  createdAt: string
  pushedToJira: boolean
  jiraCommentId?: string
}

// ---- Page Toggles ----

export interface PageToggles {
  jobs: boolean
  partsBrowser: boolean
  parts: boolean
  queue: boolean
  templates: boolean
  bom: boolean
  certs: boolean
  jira: boolean
  audit: boolean
}

// ---- Settings ----

export interface AppSettings {
  id: string
  jiraConnection: JiraConnectionSettings
  jiraFieldMappings: JiraFieldMapping[]
  pageToggles: PageToggles
  updatedAt: string
}

export interface JiraConnectionSettings {
  baseUrl: string
  projectKey: string
  username: string
  apiToken: string
  enabled: boolean
  pushEnabled: boolean
}

export interface JiraFieldMapping {
  id: string
  jiraFieldId: string
  label: string
  shopErpField: string
  isDefault: boolean
}

// ---- Filter State ----

export interface FilterState {
  jobName?: string
  jiraTicketKey?: string
  stepName?: string
  assignee?: string
  priority?: string
  label?: string
  status?: 'active' | 'completed' | 'all'
}

// ---- Part Step Status (formerly SN Step Status) ----

export type PartStepStatusValue = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'deferred' | 'waived'

/** @deprecated Use `PartStepStatusValue` instead. Backward-compatible alias. */
export type SnStepStatusValue = PartStepStatusValue

export interface PartStepStatus {
  id: string
  partId: string
  stepId: string
  stepIndex: number
  status: PartStepStatusValue
  updatedAt: string
}

/** @deprecated Use `PartStepStatus` instead. Backward-compatible alias. */
export type SnStepStatus = PartStepStatus

// ---- Part Step Override (formerly SN Step Override) ----

export interface PartStepOverride {
  id: string
  partId: string
  stepId: string
  active: boolean
  reason?: string
  createdBy: string
  createdAt: string
}

/** @deprecated Use `PartStepOverride` instead. Backward-compatible alias. */
export type SnStepOverride = PartStepOverride

// ---- BOM Version ----

export interface BomVersion {
  id: string
  bomId: string
  versionNumber: number
  entriesSnapshot: readonly BomEntry[]
  changeDescription?: string
  changedBy: string
  createdAt: string
}

// ---- Process Library ----

export interface ProcessLibraryEntry {
  id: string
  name: string
  createdAt: string
}

// ---- Location Library ----

export interface LocationLibraryEntry {
  id: string
  name: string
  createdAt: string
}
