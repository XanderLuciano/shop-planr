/**
 * Property Test — Readonly Array Constraint on Domain Types
 *
 * Feature: readonly-domain-types, Property 1: Readonly array constraint on domain types
 *
 * Maintains a canonical list of { file, interface, property } tuples for every
 * array property listed in the design document. Uses fast-check to randomly
 * select entries and asserts each property declaration includes the `readonly`
 * keyword (i.e. `readonly T[]` or `readonly { ... }[]`).
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 5.2**
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import * as fs from 'fs'
import * as path from 'path'

// ---------------------------------------------------------------------------
// Canonical list of array properties from the design document
// ---------------------------------------------------------------------------

interface ArrayPropertyEntry {
  file: string
  iface: string
  property: string
}

const CANONICAL_ARRAY_PROPERTIES: ArrayPropertyEntry[] = [
  // server/types/domain.ts
  { file: 'server/types/domain.ts', iface: 'Job', property: 'jiraLabels' },
  { file: 'server/types/domain.ts', iface: 'Path', property: 'steps' },
  { file: 'server/types/domain.ts', iface: 'TemplateRoute', property: 'steps' },
  { file: 'server/types/domain.ts', iface: 'BOM', property: 'entries' },
  { file: 'server/types/domain.ts', iface: 'StepNote', property: 'partIds' },
  { file: 'server/types/domain.ts', iface: 'BomVersion', property: 'entriesSnapshot' },

  // server/types/computed.ts
  { file: 'server/types/computed.ts', iface: 'OperatorStepView', property: 'stepIds' },
  { file: 'server/types/computed.ts', iface: 'OperatorStepView', property: 'currentParts' },
  { file: 'server/types/computed.ts', iface: 'OperatorStepView', property: 'comingSoon' },
  { file: 'server/types/computed.ts', iface: 'OperatorStepView', property: 'backlog' },
  { file: 'server/types/computed.ts', iface: 'WorkQueueJob', property: 'partIds' },
  { file: 'server/types/computed.ts', iface: 'BomSummary', property: 'entries' },
  { file: 'server/types/computed.ts', iface: 'AdvancementResult', property: 'bypassed' },

  // server/services/jiraService.ts
  { file: 'server/services/jiraService.ts', iface: 'JiraTicket', property: 'labels' },
  { file: 'server/services/jiraService.ts', iface: 'FetchTicketsResult', property: 'tickets' },

  // server/types/api.ts
  { file: 'server/types/api.ts', iface: 'BatchAttachCertInput', property: 'partIds' },
  { file: 'server/types/api.ts', iface: 'CreateStepOverrideInput', property: 'partIds' },
  { file: 'server/types/api.ts', iface: 'CreateJobInput', property: 'jiraLabels' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the block of text for a given interface from a source file.
 * Handles both top-level `interface Foo { ... }` and inline object types
 * within other interfaces (for nested entries like CreateBomInput).
 */
function extractInterfaceBlock(source: string, iface: string): string | null {
  const interfaceRegex = new RegExp(
    `(?:export\\s+)?interface\\s+${iface}\\s*(?:<[^>]*>)?\\s*(?:extends\\s+[^{]*)?\\{`,
  )
  const match = interfaceRegex.exec(source)
  if (!match) return null

  const startIdx = match.index + match[0].length
  let depth = 1
  let idx = startIdx
  while (idx < source.length && depth > 0) {
    if (source[idx] === '{') depth++
    else if (source[idx] === '}') depth--
    idx++
  }
  return source.slice(match.index, idx)
}

/**
 * Assert that a property declaration within an interface block contains
 * the `readonly` keyword before the array type.
 *
 * Matches patterns like:
 *   property: readonly string[]
 *   property?: readonly string[]
 *   property: readonly SomeType[]
 *   property: readonly { ... }[]
 */
function assertPropertyIsReadonly(
  interfaceBlock: string,
  property: string,
  entry: ArrayPropertyEntry,
): void {
  // Match the property declaration line(s) — handles optional (?) marker
  const propRegex = new RegExp(
    `${property}\\??\\s*:\\s*(.+?)(?:$|[;\\n])`,
    'm',
  )
  const propMatch = propRegex.exec(interfaceBlock)

  expect(
    propMatch,
    `Property "${property}" not found in interface "${entry.iface}" in ${entry.file}`,
  ).not.toBeNull()

  const typeDecl = propMatch![1].trim()

  // The type declaration must start with "readonly " to satisfy the constraint
  expect(
    typeDecl.startsWith('readonly '),
    `${entry.file} → ${entry.iface}.${property} should be "readonly T[]" but found: "${typeDecl}"`,
  ).toBe(true)
}

// ---------------------------------------------------------------------------
// Property Test
// ---------------------------------------------------------------------------

describe('Feature: readonly-domain-types, Property 1: Readonly array constraint on domain types', () => {
  /**
   * Property: Every array property in the canonical list is declared with
   * `readonly T[]` in its source file.
   *
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 5.2**
   */
  it('Property: All canonical array properties are declared as readonly', () => {
    // Pre-read all source files into a cache to avoid repeated I/O
    const fileCache = new Map<string, string>()
    for (const entry of CANONICAL_ARRAY_PROPERTIES) {
      if (!fileCache.has(entry.file)) {
        const absolutePath = path.resolve(process.cwd(), entry.file)
        expect(
          fs.existsSync(absolutePath),
          `Source file must exist: ${entry.file}`,
        ).toBe(true)
        fileCache.set(entry.file, fs.readFileSync(absolutePath, 'utf-8'))
      }
    }

    fc.assert(
      fc.property(
        fc.constantFrom(...CANONICAL_ARRAY_PROPERTIES),
        (entry: ArrayPropertyEntry) => {
          const source = fileCache.get(entry.file)!
          const block = extractInterfaceBlock(source, entry.iface)

          expect(
            block,
            `Interface "${entry.iface}" not found in ${entry.file}`,
          ).not.toBeNull()

          assertPropertyIsReadonly(block!, entry.property, entry)
        },
      ),
      { numRuns: 100 },
    )
  })
})
