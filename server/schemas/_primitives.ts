/**
 * Shared Zod primitives for schema composition.
 *
 * Centralizes frequently-reused field schemas so domain schema files
 * can import them instead of re-declaring the same patterns.
 * Prefix-free — consumers import named constants directly.
 */
import { z } from 'zod'

// ── ID fields ──

/** Non-empty string ID. Use for any required entity reference (jobId, pathId, stepId, etc.). */
export const requiredId = z.string().min(1)

// ── Domain enums ──

export const dependencyTypeEnum = z.enum(['physical', 'preferred', 'completion_gate'])
export const advancementModeEnum = z.enum(['strict', 'flexible', 'per_step'])
export const scrapReasonEnum = z.enum(['out_of_tolerance', 'process_defect', 'damaged', 'operator_error', 'other'])
export const certTypeEnum = z.enum(['material', 'process'])

// ── Numeric fields ──

/** Positive integer (> 0). Use for goalQuantity, requiredQuantity, priority, etc. */
export const positiveInt = z.number().int().positive()

// ── Batch ID arrays ──

/** Array of 1–100 non-empty ID strings. Use for standard batch operations. */
export const batchIds100 = z.array(requiredId).min(1).max(100)

/** Array of 1–500 non-empty ID strings. Use for larger read-only batch fetches. */
export const batchIds500 = z.array(requiredId).min(1).max(500)

// ── Auth ──

/** 4-digit PIN string. */
export const pinSchema = z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits')
