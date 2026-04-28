/**
 * Shared Zod primitives for schema composition.
 *
 * Centralizes frequently-reused field schemas so domain schema files
 * can import them instead of re-declaring the same patterns.
 *
 * Domain enums are derived from the const arrays in `server/types/domain.ts`
 * — that file is the single source of truth for allowed values. Adding a new
 * enum variant there automatically updates both the TypeScript type and the
 * Zod schema.
 */
import { z } from 'zod'
import {
  ADVANCEMENT_MODES,
  DEPENDENCY_TYPES,
  SCRAP_REASONS,
  CERT_TYPES,
} from '../types/domain'

// ── ID fields ──

/** Non-empty string ID. Use for any required entity reference (jobId, pathId, stepId, etc.). */
export const requiredId = z.string().min(1)

// ── Domain enums (derived from domain.ts const arrays) ──

export const dependencyTypeEnum = z.enum(DEPENDENCY_TYPES)
export const advancementModeEnum = z.enum(ADVANCEMENT_MODES)
export const scrapReasonEnum = z.enum(SCRAP_REASONS)
export const certTypeEnum = z.enum(CERT_TYPES)

// ── Numeric fields ──

/** Positive integer (> 0). Use for goalQuantity, requiredQuantity, priority, etc. */
export const positiveInt = z.number().int().positive()

// ── Auth ──

/** 4-digit PIN string. */
export const pinSchema = z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits')
