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
  priority: number
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

export const ADVANCEMENT_MODES = ['strict', 'flexible', 'per_step'] as const
export type AdvancementMode = typeof ADVANCEMENT_MODES[number]

export interface Path {
  id: string
  jobId: string
  name: string
  goalQuantity: number
  steps: readonly ProcessStep[]
  advancementMode: AdvancementMode
  createdAt: string
  updatedAt: string
}

// ---- Process Step ----

export const DEPENDENCY_TYPES = ['physical', 'preferred', 'completion_gate'] as const
export type DependencyType = typeof DEPENDENCY_TYPES[number]

export interface ProcessStep {
  id: string
  name: string
  order: number
  location?: string
  assignedTo?: string
  optional: boolean
  dependencyType: DependencyType
  removedAt?: string // soft-delete timestamp; null/undefined = active
  completedCount: number // write-time counter: parts that have completed this step
}

// ---- Step Input (for path update reconciliation) ----

export interface StepInput {
  id?: string // optional existing step ID for reconciliation
  name: string
  location?: string
  assignedTo?: string | null // undefined = no change/preserve, null = clear assignment
  optional?: boolean
  dependencyType?: DependencyType
}

// ---- Part (formerly Serial Number) ----

export const SCRAP_REASONS = ['out_of_tolerance', 'process_defect', 'damaged', 'operator_error', 'other'] as const
export type ScrapReason = typeof SCRAP_REASONS[number]

export interface Part {
  id: string
  jobId: string
  pathId: string
  currentStepId: string | null // null = completed; replaces currentStepIndex
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

export const CERT_TYPES = ['material', 'process'] as const
export type CertType = typeof CERT_TYPES[number]

export interface Certificate {
  id: string
  type: CertType
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
  dependencyType: DependencyType
}

// ---- BOM (Bill of Materials) ----

export interface BOM {
  id: string
  name: string
  entries: readonly BomEntry[]
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface BomEntry {
  id?: string
  bomId?: string
  jobId: string
  requiredQuantity: number
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
    | 'bom_archived'
    | 'path_deleted'
    | 'part_deleted'
    | 'tag_created'
    | 'tag_updated'
    | 'tag_deleted'

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
  username: string
  displayName: string
  isAdmin: boolean
  department?: string
  active: boolean
  pinHash?: string | null
  createdAt: string
}

/** Public-facing user shape — strips pinHash, exposes hasPin boolean instead. */
export interface PublicUser {
  id: string
  username: string
  displayName: string
  isAdmin: boolean
  department?: string
  active: boolean
  hasPin: boolean
  createdAt: string
}

/** Convert a ShopUser to a PublicUser, stripping the pinHash. */
export function toPublicUser(user: ShopUser): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    isAdmin: user.isAdmin,
    department: user.department,
    active: user.active,
    hasPin: !!user.pinHash,
    createdAt: user.createdAt,
  }
}

// ---- Crypto Key (ES256 JWT signing) ----

export interface CryptoKey {
  id: string
  algorithm: string
  publicKey: string
  privateKey: string
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
  webhooks: boolean
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
  tagIds?: string[]
  groupByTag?: boolean
}

// ---- Part Step Status (formerly SN Step Status) ----

export type PartStepStatusValue = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'deferred' | 'waived'

/** @deprecated Use `PartStepStatusValue` instead. Backward-compatible alias. */
export type SnStepStatusValue = PartStepStatusValue

export interface PartStepStatus {
  id: string
  partId: string
  stepId: string
  sequenceNumber: number // replaces stepIndex; 1-based, monotonically increasing per part
  status: PartStepStatusValue
  enteredAt: string // when the part entered this step visit
  completedAt?: string // when this visit was completed (if applicable)
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

// ---- Tag ----

export interface Tag {
  id: string
  name: string
  color: string
  createdAt: string
  updatedAt: string
}

// ---- Webhook Events ----

export const WEBHOOK_EVENT_TYPES = [
  'part_advanced',
  'part_completed',
  'part_created',
  'part_scrapped',
  'part_force_completed',
  'part_deleted',
  'step_skipped',
  'step_deferred',
  'step_waived',
  'deferred_step_completed',
  'step_override_created',
  'step_override_reversed',
  'job_created',
  'job_deleted',
  'path_deleted',
  'note_created',
  'cert_attached',
] as const
export type WebhookEventType = typeof WEBHOOK_EVENT_TYPES[number]

export interface WebhookEvent {
  id: string
  eventType: WebhookEventType
  payload: Record<string, unknown>
  summary: string
  createdAt: string
}

// ---- Webhook Registrations ----

export interface WebhookRegistration {
  id: string
  name: string
  url: string
  eventTypes: WebhookEventType[]
  createdAt: string
  updatedAt: string
}

// ---- Webhook Deliveries ----

export const WEBHOOK_DELIVERY_STATUSES = ['queued', 'delivering', 'delivered', 'failed', 'canceled'] as const
export type WebhookDeliveryStatus = typeof WEBHOOK_DELIVERY_STATUSES[number]

export interface WebhookDelivery {
  id: string
  eventId: string
  registrationId: string | null
  status: WebhookDeliveryStatus
  error?: string
  attemptCount: number
  nextRetryAt?: string
  createdAt: string
  updatedAt: string
}

/** Delivery with joined registration info for the dispatch engine */
export interface QueuedDeliveryView {
  id: string
  eventId: string
  registrationId: string
  registrationName: string
  registrationUrl: string
  eventType: WebhookEventType
  payload: Record<string, unknown>
  summary: string
  eventCreatedAt: string
}

/** Delivery with registration info for the event log UI */
export interface DeliveryDetail {
  id: string
  registrationId: string | null
  registrationName: string
  registrationUrl: string
  status: WebhookDeliveryStatus
  error?: string
  attemptCount: number
  nextRetryAt?: string
  createdAt: string
  updatedAt: string
}

/** Event with delivery summary for the event log */
export interface EventWithDeliveries {
  id: string
  eventType: WebhookEventType
  payload: Record<string, unknown>
  summary: string
  createdAt: string
  deliverySummary: {
    total: number
    queued: number
    delivering: number
    delivered: number
    failed: number
    canceled: number
  }
}
