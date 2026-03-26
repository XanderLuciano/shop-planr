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
  jiraLabels?: string[]
  createdAt: string
  updatedAt: string
}

// ---- Path ----

export interface Path {
  id: string
  jobId: string
  name: string
  goalQuantity: number
  steps: ProcessStep[]
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

// ---- Serial Number ----

export type ScrapReason = 'out_of_tolerance' | 'process_defect' | 'damaged' | 'operator_error' | 'other'

export interface SerialNumber {
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
  serialId: string
  certId: string
  stepId: string
  attachedAt: string
  attachedBy: string
}

// ---- Template Route ----

export interface TemplateRoute {
  id: string
  name: string
  steps: TemplateStep[]
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
  entries: BomEntry[]
  createdAt: string
  updatedAt: string
}

export interface BomEntry {
  id?: string
  bomId?: string
  partType: string
  requiredQuantityPerBuild: number
  contributingJobIds: string[]
}

// ---- Audit Trail ----

export type AuditAction
  = | 'cert_attached'
    | 'serial_created'
    | 'serial_advanced'
    | 'serial_completed'
    | 'note_created'
    | 'serial_scrapped'
    | 'serial_force_completed'
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
  serialId?: string
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
  serialIds: string[]
  text: string
  createdBy: string
  createdAt: string
  pushedToJira: boolean
  jiraCommentId?: string
}

// ---- Page Toggles ----

export interface PageToggles {
  jobs: boolean
  serials: boolean
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

// ---- SN Step Status ----

export type SnStepStatusValue = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'deferred' | 'waived'

export interface SnStepStatus {
  id: string
  serialId: string
  stepId: string
  stepIndex: number
  status: SnStepStatusValue
  updatedAt: string
}

// ---- SN Step Override ----

export interface SnStepOverride {
  id: string
  serialId: string
  stepId: string
  active: boolean
  reason?: string
  createdBy: string
  createdAt: string
}

// ---- BOM Version ----

export interface BomVersion {
  id: string
  bomId: string
  versionNumber: number
  entriesSnapshot: BomEntry[]
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
