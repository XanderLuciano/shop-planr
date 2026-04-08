/**
 * Bug Condition Exploration Tests — TypeScript Typecheck Errors
 *
 * These tests MUST FAIL on unfixed code — failure confirms the bug exists.
 * DO NOT fix the code or the test when it fails.
 *
 * Bug: app/ files import types directly from ~/server/... paths, which
 * violate Nuxt 4 module resolution (~ resolves to app/, not project root).
 * Additionally, the shared types layer (app/types/) does not yet exist.
 *
 * **Validates: Requirements 1.2, 2.2**
 *
 * Expected counterexamples on unfixed code:
 *   - app/composables/useJobs.ts contains `import type { Job } from '~/server/types/domain'`
 *   - app/composables/useParts.ts contains `import type { Part } from '~/server/types/domain'`
 *   - app/composables/useJira.ts contains `import type { JiraTicket, ... } from '~/server/services/jiraService'`
 *   - app/composables/useOperatorWorkQueue.ts contains `import type { WorkQueueGroup, ... } from '~/server/types/computed'`
 *   - app/pages/jira.vue contains `import type { JiraTicket } from '~/server/services/jiraService'`
 *   - app/pages/jobs/index.vue contains `import type { Job, FilterState } from '~/server/types/domain'`
 *   - app/components/AdvanceToStepDropdown.vue contains `import type { ProcessStep } from '~/server/types/domain'`
 *   - (and many more — see full grep results below)
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import * as fs from 'fs'
import * as path from 'path'

// ---------------------------------------------------------------------------
// Full list of app/ files known to contain ~/server/ imports (grep confirmed)
// ---------------------------------------------------------------------------
const CROSS_LAYER_IMPORT_FILES = [
  // Composables
  'app/composables/useJobs.ts',
  'app/composables/useParts.ts',
  'app/composables/useJira.ts',
  'app/composables/useOperatorWorkQueue.ts',
  'app/composables/useLifecycle.ts',
  'app/composables/usePartBrowser.ts',
  'app/composables/usePartDetail.ts',
  'app/composables/usePartsView.ts',
  'app/composables/useStepView.ts',
  'app/composables/usePaths.ts',
  'app/composables/useCerts.ts',
  'app/composables/useSettings.ts',
  'app/composables/useNotes.ts',
  'app/composables/useLibrary.ts',
  'app/composables/useBom.ts',
  'app/composables/useAudit.ts',
  'app/composables/useTemplates.ts',
  'app/composables/useBomVersions.ts',
  'app/composables/useJobForm.ts',
  'app/composables/useViewFilters.ts',
  // Pages
  'app/pages/jira.vue',
  'app/pages/jobs/index.vue',
  'app/pages/jobs/[id].vue',
  'app/pages/jobs/edit/[id].vue',
  'app/pages/parts-browser/[id].vue',
  'app/pages/parts/index.vue',
  'app/pages/bom.vue',
  'app/pages/certs.vue',
  'app/pages/queue.vue',
  'app/pages/templates.vue',
  'app/pages/settings.vue',
  'app/pages/index.vue',
  // Components
  'app/components/AdvanceToStepDropdown.vue',
  'app/components/StepTracker.vue',
  'app/components/AuditLog.vue',
  'app/components/StepOverridePanel.vue',
  'app/components/DeferredStepsList.vue',
  'app/components/WorkQueueList.vue',
  'app/components/BomEditor.vue',
  'app/components/JobForm.vue',
  'app/components/JiraConnectionForm.vue',
  'app/components/ScrapDialog.vue',
  'app/components/JobPartsTab.vue',
  'app/components/JobCreationForm.vue',
  'app/components/CertForm.vue',
  'app/components/PathEditor.vue',
  'app/components/ViewFilters.vue',
  'app/components/StepNoteList.vue',
  'app/components/UserForm.vue',
  'app/components/OperatorView.vue',
]

// The shared types layer files that must exist after the fix
const SHARED_TYPES_FILES = [
  'app/types/domain.ts',
  'app/types/computed.ts',
  'app/types/api.ts',
  'app/types/jira.ts',
]

// Regex to detect ~/server/ import patterns
const CROSS_LAYER_IMPORT_PATTERN = /from\s+['"]~\/server\//

describe('Bug Condition Exploration — TypeScript Cross-Layer Imports', () => {
  /**
   * Property 1: No cross-layer imports in app/ files
   *
   * For any randomly selected file from the known list of cross-layer
   * import files, reading its contents from disk and checking for the
   * ~/server/ import pattern should find NO matches.
   *
   * On UNFIXED code, this FAILS because files like useJobs.ts contain
   * `import type { Job } from '~/server/types/domain'`.
   *
   * **Validates: Requirements 1.2, 2.2**
   */
  it('Property 1: No app/ file should import from ~/server/', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CROSS_LAYER_IMPORT_FILES),
        (filePath) => {
          const absolutePath = path.resolve(process.cwd(), filePath)

          // File must exist
          expect(fs.existsSync(absolutePath), `File should exist: ${filePath}`).toBe(true)

          const contents = fs.readFileSync(absolutePath, 'utf-8')

          // Assert no ~/server/ import pattern
          const hasViolation = CROSS_LAYER_IMPORT_PATTERN.test(contents)
          expect(
            hasViolation,
            `${filePath} contains a cross-layer import from ~/server/ — this violates Nuxt 4 module resolution and separation-of-concerns`,
          ).toBe(false)
        },
      ),
      { numRuns: 50 },
    )
  })

  /**
   * Property 2: Shared types layer exists
   *
   * Assert that all four shared type files exist on disk.
   * On UNFIXED code, these files don't exist, so this FAILS.
   *
   * **Validates: Requirements 2.2**
   */
  it('Property 2: Shared types layer (app/types/) must exist', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SHARED_TYPES_FILES),
        (filePath) => {
          const absolutePath = path.resolve(process.cwd(), filePath)
          expect(
            fs.existsSync(absolutePath),
            `Shared types file must exist: ${filePath} — create app/types/ layer to fix cross-layer imports`,
          ).toBe(true)
        },
      ),
      { numRuns: 10 },
    )
  })
})
