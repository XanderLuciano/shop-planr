/**
 * Computed / view types for SHOP_ERP.
 *
 * These types represent derived data computed by the service layer
 * for display in the frontend. They are not persisted directly.
 */

import type { Part, PartStepStatusValue, StepNote } from './domain'

// ---- Job Progress ----

export interface JobProgress {
  jobId: string
  jobName: string
  goalQuantity: number
  totalParts: number
  completedParts: number
  inProgressParts: number
  scrappedParts: number
  producedQuantity: number         // total parts created (including scrapped)
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
  partCount: number
  completedCount: number
  isBottleneck: boolean
}

// ---- BOM Summary ----

export interface BomSummary {
  bomId: string
  bomName: string
  entries: readonly BomEntrySummary[]
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
  currentParts: readonly OperatorPartInfo[]
  comingSoon: readonly OperatorPartInfo[]
  backlog: readonly OperatorPartInfo[]
  vendorPartsCount: number
  /** All matching step IDs for this step name across jobs/paths */
  stepIds: readonly string[]
}

export interface OperatorPartInfo {
  partId: string
  jobId: string
  jobName: string
  pathId: string
  pathName: string
  timeAtStep?: number
  nextStepName?: string
  nextStepLocation?: string
}

// ---- Enriched Part (formerly Enriched Serial) ----

export interface EnrichedPart {
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

/** @deprecated Use `EnrichedPart` instead. Backward-compatible alias. */
export type EnrichedSerial = EnrichedPart

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
  partIds: readonly string[]
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
  serial: Part
  bypassed: readonly { stepId: string; stepName: string; classification: 'skipped' | 'deferred' }[]
}

// ---- Part Step Status View (formerly SN Step Status View) ----

export interface PartStepStatusView {
  stepId: string
  stepName: string
  stepOrder: number
  status: PartStepStatusValue
  optional: boolean
  dependencyType: 'physical' | 'preferred' | 'completion_gate'
  hasOverride: boolean
}

/** @deprecated Use `PartStepStatusView` instead. Backward-compatible alias. */
export type SnStepStatusView = PartStepStatusView
