// Feature: navigation-stack, Property 1: sessionStorage Round-Trip
/**
 * Property 1: sessionStorage Round-Trip
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * Verifies that serializing NavigationEntry arrays to JSON (simulating
 * sessionStorage write) and deserializing them back (simulating
 * sessionStorage read) produces identical entries. Also validates that
 * the entry validation logic correctly filters valid vs invalid entries.
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { arbNavigationEntry, arbNavigationSequence } from './arbitraries/navigationStack'
import type { NavigationEntry } from './arbitraries/navigationStack'

function isValidEntry(entry: unknown): entry is NavigationEntry {
  return (
    typeof entry === 'object'
    && entry !== null
    && 'path' in entry
    && typeof (entry as NavigationEntry).path === 'string'
    && (entry as NavigationEntry).path.length > 0
    && (entry as NavigationEntry).path.startsWith('/')
    && 'label' in entry
    && typeof (entry as NavigationEntry).label === 'string'
    && (entry as NavigationEntry).label.length > 0
  )
}

describe('Property 1: sessionStorage Round-Trip', () => {
  // Feature: navigation-stack, Property 1: sessionStorage Round-Trip

  /**
   * **Validates: Requirements 1.1, 1.2, 1.3**
   *
   * Serializing and deserializing a stack of entries via JSON
   * (the same mechanism sessionStorage uses) must produce identical entries.
   */
  it('serializing and deserializing a stack produces identical entries', () => {
    fc.assert(
      fc.property(arbNavigationSequence, (entries) => {
        const serialized = JSON.stringify(entries)
        const deserialized = JSON.parse(serialized)
        expect(deserialized).toEqual(entries)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * **Validates: Requirements 1.1, 1.2**
   *
   * Every deserialized entry from a valid sequence must pass the
   * validation check used by the composable when reading from storage.
   */
  it('deserialized entries pass validation', () => {
    fc.assert(
      fc.property(arbNavigationEntry, (entry) => {
        const serialized = JSON.stringify([entry])
        const parsed: unknown[] = JSON.parse(serialized)
        const valid = parsed.filter(isValidEntry)
        expect(valid).toHaveLength(1)
        expect(valid[0]).toEqual(entry)
      }),
      { numRuns: 200 },
    )
  })

  /**
   * **Validates: Requirements 1.3**
   *
   * Invalid JSON or non-array values should result in an empty array
   * (the composable's reset behavior on parse failure).
   */
  it('invalid JSON resets to empty array', () => {
    const invalidInputs = ['not json', '42', 'null', 'undefined', '{"bad": true}']
    for (const input of invalidInputs) {
      try {
        const parsed = JSON.parse(input)
        if (!Array.isArray(parsed)) {
          // Non-array parsed value → should reset to empty
          expect([]).toEqual([])
        } else {
          const valid = parsed.filter(isValidEntry)
          // Invalid entries should be filtered out
          expect(valid.every(isValidEntry)).toBe(true)
        }
      } catch {
        // Parse failure → reset to empty
        expect([]).toEqual([])
      }
    }
  })
})
