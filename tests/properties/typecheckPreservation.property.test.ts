/**
 * Preservation Property Tests — TypeScript Typecheck Errors Bugfix
 *
 * These tests MUST PASS on unfixed code — they establish the baseline
 * behavior that must be preserved after the fix is applied.
 *
 * Test 1 — Server files use relative imports only
 *   Scans server/ for .ts files and asserts none contain ~/  import paths.
 *   Server code already uses relative imports (../types/domain, etc.).
 *   Validates: Requirement 3.1
 *
 * Test 2 — Test files resolve vitest aliases
 *   Scans tests/ for .ts files that contain ~/server/ or ~/app/ imports.
 *   Asserts those imports follow the vitest alias pattern (~/server/... or ~/app/...).
 *   Validates: Requirement 3.2
 *
 * Test 3 — Domain type exports are complete
 *   Reads server/types/domain.ts, server/types/computed.ts, server/types/api.ts
 *   and asserts each file exists, is non-empty, and exports the expected
 *   representative type names via `export type` or `export interface`.
 *   Validates: Requirement 3.6
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import * as fs from 'fs'
import * as path from 'path'

// ---------------------------------------------------------------------------
// Helpers — recursive file enumeration
// ---------------------------------------------------------------------------

function collectTsFiles(dir: string): string[] {
  const results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      results.push(fullPath)
    }
  }
  return results
}

/** Convert absolute path to workspace-relative for readable assertion messages */
function rel(absolutePath: string): string {
  return path.relative(process.cwd(), absolutePath)
}

// ---------------------------------------------------------------------------
// Test 1 — Server files use relative imports only
// ---------------------------------------------------------------------------

describe('Preservation Test 1 — Server files use relative imports only', () => {
  const serverDir = path.resolve(process.cwd(), 'server')
  const serverTsFiles = collectTsFiles(serverDir)

  // Regex: any import/require that uses the ~ alias
  const TILDE_IMPORT_PATTERN = /from\s+['"]~[/\\]|require\s*\(\s*['"]~[/\\]/

  /**
   * Property: No server/ TypeScript file uses the ~ alias in its imports.
   * Server code must use relative paths only (../types/domain, etc.).
   *
   * This PASSES on unfixed code because server files already use relative imports.
   *
   * **Validates: Requirements 3.1**
   */
  it('Property: No server/ file imports via ~/  alias (relative imports only)', () => {
    expect(serverTsFiles.length).toBeGreaterThan(0)

    fc.assert(
      fc.property(
        fc.constantFrom(...serverTsFiles),
        (filePath) => {
          const relativePath = rel(filePath)
          expect(fs.existsSync(filePath), `File should exist: ${relativePath}`).toBe(true)

          const contents = fs.readFileSync(filePath, 'utf-8')
          const hasTildeImport = TILDE_IMPORT_PATTERN.test(contents)

          expect(
            hasTildeImport,
            `${relativePath} uses a ~/  alias import — server files must use relative paths only`,
          ).toBe(false)
        },
      ),
      { numRuns: Math.min(serverTsFiles.length, 100) },
    )
  })
})

// ---------------------------------------------------------------------------
// Test 2 — Test files resolve vitest aliases
// ---------------------------------------------------------------------------

describe('Preservation Test 2 — Test files resolve vitest aliases correctly', () => {
  const testsDir = path.resolve(process.cwd(), 'tests')
  const allTestTsFiles = collectTsFiles(testsDir)

  // Pattern to find any ~/  import in a file
  const ANY_TILDE_IMPORT = /from\s+['"]~\/([^'"]+)['"]/g

  // Valid vitest alias patterns: ~/server/... or ~/app/...
  const VALID_ALIAS_PATTERN = /^~\/(server|app)\//

  // Filter to only files that actually contain ~/server/ or ~/app/ imports
  const filesWithAliasImports = allTestTsFiles.filter((filePath) => {
    const contents = fs.readFileSync(filePath, 'utf-8')
    return /from\s+['"]~\/(server|app)\//.test(contents)
  })

  /**
   * Property: Any ~/  import in a test file follows the vitest alias pattern
   * (~/server/... or ~/app/...). No other ~/  prefix is valid in test files.
   *
   * This PASSES on unfixed code because test files already use the correct
   * vitest alias pattern pointing to project root.
   *
   * **Validates: Requirements 3.2**
   */
  it('Property: Test file ~/  imports follow ~/server/... or ~/app/... pattern', () => {
    // If no test files have alias imports, the property trivially holds
    if (filesWithAliasImports.length === 0) {
      return
    }

    fc.assert(
      fc.property(
        fc.constantFrom(...filesWithAliasImports),
        (filePath) => {
          const relativePath = rel(filePath)
          const contents = fs.readFileSync(filePath, 'utf-8')

          // Extract all ~/... import paths from this file
          const matches = [...contents.matchAll(ANY_TILDE_IMPORT)]
          for (const match of matches) {
            const fullImport = `~/${match[1]}`
            expect(
              VALID_ALIAS_PATTERN.test(fullImport),
              `${relativePath} has import "${fullImport}" — test file ~/  imports must start with ~/server/ or ~/app/`,
            ).toBe(true)
          }
        },
      ),
      { numRuns: Math.min(filesWithAliasImports.length, 100) },
    )
  })
})

// ---------------------------------------------------------------------------
// Test 3 — Domain type exports are complete
// ---------------------------------------------------------------------------

describe('Preservation Test 3 — Domain type exports are complete', () => {
  const TYPE_FILES = [
    {
      relativePath: 'server/types/domain.ts',
      expectedExports: [
        'Job',
        'Path',
        'ProcessStep',
        'Part',
        'Certificate',
        'CertAttachment',
        'TemplateRoute',
        'TemplateStep',
        'BOM',
        'BomEntry',
        'AuditEntry',
        'AuditAction',
        'ShopUser',
        'StepNote',
        'PageToggles',
        'AppSettings',
        'JiraConnectionSettings',
        'JiraFieldMapping',
        'FilterState',
        'PartStepStatus',
        'PartStepStatusValue',
        'PartStepOverride',
        'ScrapReason',
        'BomVersion',
        'ProcessLibraryEntry',
        'LocationLibraryEntry',
      ],
    },
    {
      relativePath: 'server/types/computed.ts',
      expectedExports: [
        'JobProgress',
        'StepDistribution',
        'BomSummary',
        'BomEntrySummary',
        'OperatorStepView',
        'OperatorPartInfo',
        'EnrichedPart',
        'WorkQueueJob',
        'WorkQueueResponse',
        'WorkQueueGroupedResponse',
        'StepViewResponse',
        'AdvancementResult',
        'PartStepStatusView',
      ],
    },
    {
      relativePath: 'server/types/api.ts',
      expectedExports: [
        'CreateJobInput',
        'UpdateJobInput',
        'CreatePathInput',
        'BatchCreatePartsInput',
        'AdvancePartInput',
        'AttachCertInput',
        'CreateCertInput',
        'CreateTemplateInput',
        'CreateBomInput',
        'AssignStepInput',
      ],
    },
  ]

  /**
   * Property: Each server type file exists, is non-empty, and exports
   * a representative sample of the expected type names.
   *
   * Checks for `export type TypeName`, `export interface TypeName`,
   * or `export type TypeName =` declarations in the file content.
   *
   * This PASSES on unfixed code because server type files already exist
   * and export all required types.
   *
   * **Validates: Requirements 3.6**
   */
  it('Property: Server type files exist and export expected types', () => {
    // Flatten all (file, exportName) pairs for property testing
    const allChecks: { relativePath: string; exportName: string }[] = []
    for (const { relativePath, expectedExports } of TYPE_FILES) {
      for (const exportName of expectedExports) {
        allChecks.push({ relativePath, exportName })
      }
    }

    fc.assert(
      fc.property(
        fc.constantFrom(...allChecks),
        ({ relativePath, exportName }) => {
          const absolutePath = path.resolve(process.cwd(), relativePath)

          // File must exist
          expect(
            fs.existsSync(absolutePath),
            `Type file must exist: ${relativePath}`,
          ).toBe(true)

          const contents = fs.readFileSync(absolutePath, 'utf-8')

          // File must be non-empty
          expect(
            contents.trim().length,
            `Type file must be non-empty: ${relativePath}`,
          ).toBeGreaterThan(0)

          // Must export the expected type name
          // Matches: export interface Foo, export type Foo, export type Foo =
          const exportPattern = new RegExp(
            `export\\s+(?:type|interface)\\s+${exportName}[\\s<{=]`,
          )
          expect(
            exportPattern.test(contents),
            `${relativePath} must export "${exportName}" — expected an export type or export interface declaration`,
          ).toBe(true)
        },
      ),
      { numRuns: allChecks.length },
    )
  })
})
