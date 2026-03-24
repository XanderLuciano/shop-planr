/**
 * Shared validation helpers for SHOP_ERP.
 * All helpers throw ValidationError on failure.
 */

import { ValidationError } from './errors'

/** Assert that a numeric value is positive (> 0). */
export function assertPositive(value: number, fieldName: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new ValidationError(`${fieldName} must be greater than zero`)
  }
}

/** Assert that a string value is non-empty after trimming. */
export function assertNonEmpty(value: unknown, fieldName: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} is required`)
  }
}

/** Assert that an array is non-empty. */
export function assertNonEmptyArray(value: unknown, fieldName: string): void {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError(`${fieldName} must have at least one item`)
  }
}

/** Assert that a value is one of the allowed options. */
export function assertOneOf<T>(value: T, allowed: readonly T[], fieldName: string): void {
  if (!allowed.includes(value)) {
    throw new ValidationError(`${fieldName} must be one of: ${allowed.join(', ')}`)
  }
}

/** Assert that a value is a non-negative integer (>= 0). */
export function assertNonNegativeInteger(value: number, fieldName: string): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new ValidationError(`${fieldName} must be a non-negative integer`)
  }
}

/** Assert that a value is defined (not null/undefined). */
export function assertDefined<T>(value: T | null | undefined, fieldName: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new ValidationError(`${fieldName} is required`)
  }
}
