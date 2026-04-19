/**
 * Property 5: removePath removes exactly one path
 *
 * For any list of pathDrafts with length ≥ 1 and any valid pathDraft clientId in that
 * list, calling removePath(clientId) should decrease the pathDrafts length by exactly 1,
 * the removed path should no longer be present, and all other paths should remain unchanged.
 *
 * **Validates: Requirements 3.6**
 */
import { describe, it, vi } from 'vitest'
import { ref } from 'vue'
import fc from 'fast-check'

import { useJobForm } from '~/app/composables/useJobForm'

// Stub auto-imported composables
vi.stubGlobal('useAuthFetch', () => vi.fn())
vi.stubGlobal('useJobs', () => ({
  createJob: vi.fn(),
  updateJob: vi.fn(),
}))
vi.stubGlobal('usePaths', () => ({
  createPath: vi.fn(),
  updatePath: vi.fn(),
  deletePath: vi.fn(),
}))
vi.stubGlobal('useAuth', () => ({
  authenticatedUser: ref({ id: 'test-user-id', username: 'test', displayName: 'Test User', isAdmin: true, active: true, createdAt: '2024-01-01' }),
}))

describe('Property 5: removePath removes exactly one path', () => {
  it('removes exactly the targeted path and preserves all others', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }).chain(pathCount =>
          fc.tuple(fc.constant(pathCount), fc.integer({ min: 0, max: pathCount - 1 })),
        ),
        ([pathCount, removeIdx]) => {
          const { pathDrafts, addPath, removePath } = useJobForm('create')

          // Add paths
          for (let i = 0; i < pathCount; i++) {
            addPath()
            pathDrafts.value[i].name = `Path-${i}`
          }

          const targetClientId = pathDrafts.value[removeIdx]._clientId
          const lengthBefore = pathDrafts.value.length

          // Snapshot the other paths' clientIds before removal
          const otherClientIds = pathDrafts.value
            .filter(p => p._clientId !== targetClientId)
            .map(p => p._clientId)

          // Remove
          removePath(targetClientId)

          // Length decreased by exactly 1
          expect(pathDrafts.value.length).toBe(lengthBefore - 1)

          // The removed path is gone
          expect(pathDrafts.value.find(p => p._clientId === targetClientId)).toBeUndefined()

          // All other paths remain (same clientIds, same order)
          const remainingClientIds = pathDrafts.value.map(p => p._clientId)
          expect(remainingClientIds).toEqual(otherClientIds)
        },
      ),
      { numRuns: 100 },
    )
  })
})
