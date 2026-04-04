/**
 * Property 10: Edit diff correctly classifies path changes
 *
 * For any set of original Paths and any set of current PathDrafts, the diff function
 * should partition changes such that: paths whose IDs appear in originals but not in
 * drafts are classified as deletes, drafts without _existingId are classified as creates,
 * and drafts with _existingId that differ from their original are classified as updates.
 * The union of delete IDs, update IDs, and create drafts should account for all paths
 * with no overlaps.
 *
 * **Validates: Requirements 13.1, 13.2, 13.3**
 */
import { describe, it, vi } from 'vitest'
import fc from 'fast-check'

import { computePathChanges, type PathDraft } from '~/app/composables/useJobForm'

// Stub auto-imported composables
vi.stubGlobal('useJobs', () => ({
  createJob: vi.fn(),
  updateJob: vi.fn(),
}))
vi.stubGlobal('usePaths', () => ({
  createPath: vi.fn(),
  updatePath: vi.fn(),
  deletePath: vi.fn(),
}))

const processStepArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  order: fc.constant(0),
  location: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  optional: fc.boolean(),
  dependencyType: fc.constantFrom('physical' as const, 'preferred' as const, 'completion_gate' as const),
})

const originalPathArb = fc.record({
  id: fc.uuid(),
  jobId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  goalQuantity: fc.integer({ min: 1, max: 1000 }),
  steps: fc.array(processStepArb, { minLength: 1, maxLength: 4 }).map(steps =>
    steps.map((s, i) => ({ ...s, order: i })),
  ),
  advancementMode: fc.constantFrom('strict' as const, 'flexible' as const, 'per_step' as const),
  createdAt: fc.constant('2024-01-01T00:00:00Z'),
  updatedAt: fc.constant('2024-01-01T00:00:00Z'),
})

// A draft that references an existing path (for updates/unchanged)
// A brand-new draft (no _existingId)
const newDraftArb: fc.Arbitrary<PathDraft> = fc.record({
  _clientId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  goalQuantity: fc.integer({ min: 1, max: 1000 }),
  advancementMode: fc.constantFrom('strict' as const, 'flexible' as const, 'per_step' as const),
  steps: fc.array(
    fc.record({
      _clientId: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
      location: fc.string({ minLength: 0, maxLength: 20 }),
      optional: fc.boolean(),
      dependencyType: fc.constantFrom('physical' as const, 'preferred' as const, 'completion_gate' as const),
    }),
    { minLength: 1, maxLength: 4 },
  ),
})

describe('Property 10: Edit diff correctly classifies path changes', () => {
  it('partitions originals and drafts into deletes, creates, and updates with no overlaps', () => {
    fc.assert(
      fc.property(
        fc.array(originalPathArb, { minLength: 0, maxLength: 5 }),
        fc.array(newDraftArb, { minLength: 0, maxLength: 3 }),
        fc.boolean(),
        fc.array(fc.boolean(), { minLength: 5, maxLength: 5 }),
        (originals, newDrafts, keepSome, keepFlags) => {
          // Build drafts: some referencing originals (kept/modified), some new
          const keptDrafts: PathDraft[] = []
          for (let idx = 0; idx < originals.length; idx++) {
            const orig = originals[idx]!
            // Use fast-check-generated boolean to decide whether to keep each original
            const shouldKeep = keepSome && (keepFlags[idx % keepFlags.length] ?? false)
            if (shouldKeep) {
              // Create a draft referencing this original with potentially different data
              keptDrafts.push({
                _clientId: `client-${orig.id}`,
                _existingId: orig.id,
                name: orig.name + '-modified',
                goalQuantity: orig.goalQuantity,
                advancementMode: orig.advancementMode,
                steps: orig.steps.map(s => ({
                  _clientId: `step-client-${s.id}`,
                  name: s.name,
                  location: s.location ?? '',
                  optional: s.optional,
                  dependencyType: s.dependencyType,
                })),
              })
            }
          }

          const allDrafts = [...keptDrafts, ...newDrafts]
          const result = computePathChanges(originals, allDrafts)

          // Deletes: originals whose IDs are NOT in any draft's _existingId
          const draftExistingIds = new Set(
            allDrafts.filter(d => d._existingId).map(d => d._existingId!),
          )
          for (const del of result.toDelete) {
            expect(draftExistingIds.has(del.id)).toBe(false)
            expect(originals.find(o => o.id === del.id)).toBeDefined()
          }

          // Creates: drafts without _existingId
          for (const create of result.toCreate) {
            expect(create._existingId).toBeUndefined()
          }
          expect(result.toCreate.length).toBe(newDrafts.length)

          // Updates: drafts with _existingId that differ from original
          for (const upd of result.toUpdate) {
            expect(upd._existingId).toBeDefined()
            expect(originals.find(o => o.id === upd._existingId)).toBeDefined()
          }

          // No overlaps: delete IDs, update existingIds, and create clientIds are disjoint
          const deleteIds = new Set(result.toDelete.map(d => d.id))
          const updateIds = new Set(result.toUpdate.map(d => d._existingId!))

          // Delete and update IDs should not overlap
          for (const uid of updateIds) {
            expect(deleteIds.has(uid)).toBe(false)
          }

          // Creates should have no _existingId that appears in deletes or updates
          for (const c of result.toCreate) {
            expect(c._existingId).toBeUndefined()
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
