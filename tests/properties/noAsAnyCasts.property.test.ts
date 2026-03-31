/**
 * Regression Test — No `as any` casts in app layer
 *
 * Greps all .vue and .ts files under app/ for `as any` patterns and asserts
 * that only allowlisted occurrences remain. This prevents new `as any` casts
 * from being introduced without deliberate justification.
 *
 * Allowlisted casts:
 * - QRScanner.vue: BarcodeDetector Web API not in TypeScript lib types
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// ---------------------------------------------------------------------------
// Allowlist: files that are permitted to contain `as any`
// Each entry specifies the file and the maximum allowed count.
// ---------------------------------------------------------------------------

const ALLOWLIST: Record<string, number> = {
  'app/components/QRScanner.vue': 2, // BarcodeDetector Web API not in TS lib
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, extensions))
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath)
    }
  }
  return results
}

function countAsAny(content: string): number {
  // Match `as any` that isn't inside a comment or string
  // Simple regex — counts all occurrences of `as any` token pattern
  const matches = content.match(/\bas\s+any\b/g)
  return matches?.length ?? 0
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe('No `as any` casts in app layer', () => {
  it('app/ files contain zero `as any` casts outside the allowlist', () => {
    const appDir = path.resolve(process.cwd(), 'app')
    expect(fs.existsSync(appDir), 'app/ directory must exist').toBe(true)

    const files = collectFiles(appDir, ['.vue', '.ts'])
    const violations: string[] = []

    for (const filePath of files) {
      const relativePath = path.relative(process.cwd(), filePath)
      const content = fs.readFileSync(filePath, 'utf-8')
      const count = countAsAny(content)

      if (count === 0) continue

      const allowed = ALLOWLIST[relativePath] ?? 0
      if (count > allowed) {
        violations.push(
          `${relativePath}: found ${count} "as any" cast(s)${allowed > 0 ? ` (${allowed} allowed)` : ''}`,
        )
      }
    }

    expect(
      violations,
      `Found unexpected "as any" casts in app layer:\n${violations.join('\n')}`,
    ).toEqual([])
  })
})
