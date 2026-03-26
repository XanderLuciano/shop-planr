/**
 * Computed / view types for SHOP_ERP.
 *
 * These types represent derived data computed by the service layer
 * for display in the frontend. They are not persisted directly.
 */

import type { SerialNumber, SnStepStatusValue, StepNote } from './domain'

// ---- Job Progress ----

export interface JobProgress {
  jobId: string
  jobName: string
  goalQuantity: number
  totalSerials: number
  completedSerials: number
  inProgressSerials: number
  scrappedSerials: number
  producedQuantity: number         // total SNs created (including scrapped)
  orderedQuantity: number          // same as goalQuantity
  /** completedCount / (goalQuantity - scrappedCount) * 100 */
  progressPercent: number
}

// ---- Step Distribution ----

export interface StepDistribution {
  stepId: string
  stepName: string
  stepOrder: number
  location?: string
  serialCount: number
  completedCount: number
  isBottleneck: boolean
}

// ---- BOM Summary ----

export interface BomSummary {
  bomId: string
  bomName: string
  entries: BomEntrySummary[]
}

export interface BomEntrySummary {
  partType: string
  requiredQuantityPerBuild: number
  totalCompleted: number
  totalInProgress: number
  totalOutstanding: number
}

// ---- Operator View ----

export interface OperatorStepView {
  stepName: string
  location?: string
  currentParts: OperatorPartInfo[]
  comingSoon: OperatorPartInfo[]
  backlog: OperatorPartInfo[]
  vendorPartsCount: number
  /** All matching step IDs for this step name across jobs/paths */
  stepIds: string[]
}

export interface OperatorPartInfo {
  serialId: string
  jobId: string
  jobName: string
  pathId: string
  pathName: string
  timeAtStep?: number
  nextStepName?: string
  nextStepLocation?: string
}

// ---- Enriched Serial ----

export interface EnrichedSerial {
  id: string
  jobId: string
  jobName: string
  pathId: string
  pathName: string
  currentStepIndex: number
  currentStepName: string
  assignedTo?: string
  status: 'in-progress' | 'completed' | 'scrapped'
  scrapReason?: string
  forceCompleted?: boolean
  createdAt: string
}

// ---- Work Queue ----

/** A job in the operator's work queue, with parts grouped at the current step */
export interface WorkQueueJob {
  jobId: string
  jobName: string
  pathId: string
  pathName: string
  stepId: string
  stepName: string
  stepOrder: number
  stepLocation?: string
  totalSteps: number
  serialIds: string[]
  partCount: number
  previousStepId?: string
  previousStepName?: string
  nextStepId?: string
  nextStepName?: string
  nextStepLocation?: string
  isFinalStep: boolean
}

/** Response from the operator work queue endpoint */
export interface WorkQueueResponse {
  operatorId: string
  jobs: WorkQueueJob[]
  totalParts: number
}

/** A group of work entries assigned to a single operator */
export interface OperatorGroup {
  operatorId: string | null
  operatorName: string
  jobs: WorkQueueJob[]
  totalParts: number
}

/** Response from the grouped work queue endpoint */
export interface WorkQueueGroupedResponse {
  groups: OperatorGroup[]
  totalParts: number
}

/** Response from the single-step view endpoint */
export interface StepViewResponse {
  job: WorkQueueJob
  notes: StepNote[]
  previousStepWipCount?: number
}

// ---- Advancement Result ----

export interface AdvancementResult {
  serial: SerialNumber
  bypassed: { stepId: string; stepName: string; classification: 'skipped' | 'deferred' }[]
}

// ---- SN Step Status View ----

export interface SnStepStatusView {
  stepId: string
  stepName: string
  stepOrder: number
  status: SnStepStatusValue
  optional: boolean
  dependencyType: 'physical' | 'preferred' | 'completion_gate'
  hasOverride: boolean
}
