/**
 * Property 1: Edit mode initialization round-trip
 *
 * For any valid Job with Paths (each containing ProcessSteps with name, location,
 * optional, and dependencyType), initializing useJobForm in edit mode should produce
 * a jobDraft and pathDrafts array where: the job name and goalQuantity match the
 * original, each pathDraft's name, goalQuantity, and advancementMode match the
 * corresponding original Path, and each stepDraft's name, location, optional flag,
 * and dependencyType match the corresponding original ProcessStep.
 *
 * **Validates: Requirements 1.2, 2.5, 3.7, 6.3, 7.3, 8.3, 9.3, 10.3**
 */
import { describe, it, vi } from 'vitest'
import { ref } from 'vue'
import fc from 'fast-check'
import type { Job, Path, ProcessStep } from '~/server/types/domain'

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

// ---- Arbitraries ----

const depTypeArb = fc.constantFrom('physical' as const, 'preferred' as const, 'completion_gate' as const)
const advModeArb = fc.constantFrom('strict' as const, 'flexible' as const, 'per_step' as const)

const processStepArb: fc.Arbitrary<ProcessStep> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
  order: fc.integer({ min: 0, max: 100 }),
  location: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
  assignedTo: fc.constant(undefined),
  optional: fc.boolean(),
  dependencyType: depTypeArb,
})

const pathArb = (jobId: string): fc.Arbitrary<Path> =>
  fc.record({
    id: fc.uuid(),
    jobId: fc.constant(jobId),
    name: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
    goalQuantity: fc.integer({ min: 1, max: 10000 }),
    steps: fc.array(processStepArb, { minLength: 1, maxLength: 5 }).map(steps =>
      steps.map((s, i) => ({ ...s, order: i })),
    ),
    advancementMode: advModeArb,
    createdAt: fc.constant('2024-01-01T00:00:00Z'),
    updatedAt: fc.constant('2024-01-01T00:00:00Z'),
  })

const jobWithPathsArb: fc.Arbitrary<Job & { paths: Path[] }> = fc.uuid().chain(jobId =>
  fc.record({
    id: fc.constant(jobId),
    name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
    goalQuantity: fc.integer({ min: 1, max: 10000 }),
    createdAt: fc.constant('2024-01-01T00:00:00Z'),
    updatedAt: fc.constant('2024-01-01T00:00:00Z'),
    paths: fc.array(pathArb(jobId), { minLength: 0, maxLength: 4 }),
  }),
)

describe('Property 1: Edit mode initialization round-trip', () => {
  it('jobDraft and pathDrafts match the original job and paths', () => {
    fc.assert(
      fc.property(jobWithPathsArb, (existingJob) => {
        const { jobDraft, pathDrafts } = useJobForm('edit', existingJob)

        // Job-level fields match
        expect(jobDraft.value.name).toBe(existingJob.name)
        expect(jobDraft.value.goalQuantity).toBe(existingJob.goalQuantity)

        // Same number of paths
        expect(pathDrafts.value.length).toBe(existingJob.paths.length)

        for (let pi = 0; pi < existingJob.paths.length; pi++) {
          const original = existingJob.paths[pi]
          const draft = pathDrafts.value[pi]

          // Path-level fields match
          expect(draft.name).toBe(original.name)
          expect(draft.goalQuantity).toBe(original.goalQuantity)
          expect(draft.advancementMode).toBe(original.advancementMode)
          expect(draft._existingId).toBe(original.id)

          // Steps sorted by order
          const sortedOriginalSteps = original.steps.slice().sort((a, b) => a.order - b.order)
          expect(draft.steps.length).toBe(sortedOriginalSteps.length)

          for (let si = 0; si < sortedOriginalSteps.length; si++) {
            const origStep = sortedOriginalSteps[si]
            const draftStep = draft.steps[si]

            expect(draftStep.name).toBe(origStep.name)
            expect(draftStep.location).toBe(origStep.location ?? '')
            expect(draftStep.optional).toBe(origStep.optional)
            expect(draftStep.dependencyType).toBe(origStep.dependencyType)
          }
        }
      }),
      { numRuns: 100 },
    )
  })
})
