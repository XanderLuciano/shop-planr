import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import type { Job, Path, ProcessStep } from '~/server/types/domain'

import { useJobForm, computePathChanges } from '~/app/composables/useJobForm'
import type { PathDraft } from '~/app/composables/useJobForm'

// ---- Mocks ----

const mockCreateJob = vi.fn()
const mockUpdateJob = vi.fn()
const mockCreatePath = vi.fn()
const mockUpdatePath = vi.fn()
const mockDeletePath = vi.fn()
const mockApi = vi.fn()

vi.stubGlobal('useAuthFetch', () => mockApi)
vi.stubGlobal('useJobs', () => ({
  createJob: mockCreateJob,
  updateJob: mockUpdateJob,
}))
vi.stubGlobal('usePaths', () => ({
  createPath: mockCreatePath,
  updatePath: mockUpdatePath,
  deletePath: mockDeletePath,
}))
vi.stubGlobal('useAuth', () => ({
  authenticatedUser: ref({ id: 'test-user-id', username: 'test', displayName: 'Test User', isAdmin: true, active: true, createdAt: '2024-01-01' }),
}))

// Stub auto-imported utils
vi.stubGlobal('extractApiError', (err: any, fallback: string) => {
  return err?.data?.message ?? err?.message ?? fallback
})

// ---- Helpers ----

function makeStep(overrides?: Partial<ProcessStep>): ProcessStep {
  return {
    id: overrides?.id ?? 'step-1',
    name: overrides?.name ?? 'Cutting',
    order: overrides?.order ?? 0,
    location: overrides?.location,
    assignedTo: overrides?.assignedTo,
    optional: overrides?.optional ?? false,
    dependencyType: overrides?.dependencyType ?? 'preferred',
  }
}

function makePath(jobId: string, overrides?: Partial<Path>): Path {
  return {
    id: overrides?.id ?? 'path-1',
    jobId,
    name: overrides?.name ?? 'Main Route',
    goalQuantity: overrides?.goalQuantity ?? 10,
    steps: overrides?.steps ?? [makeStep()],
    advancementMode: overrides?.advancementMode ?? 'strict',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  }
}

function makeJob(overrides?: Partial<Job>): Job {
  return {
    id: overrides?.id ?? 'job-1',
    name: overrides?.name ?? 'Test Job',
    goalQuantity: overrides?.goalQuantity ?? 100,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  }
}

function makeExistingJob(jobOverrides?: Partial<Job>, paths?: Path[]): Job & { paths: Path[] } {
  const job = makeJob(jobOverrides)
  return {
    ...job,
    paths: paths ?? [makePath(job.id)],
  }
}

// ---- Tests ----

describe('useJobForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ---- Test 1: Create mode initializes with correct empty state (Req 1.1) ----

  describe('create mode initialization', () => {
    it('initializes with empty name, goalQuantity=1, and empty pathDrafts', () => {
      const { jobDraft, pathDrafts, errors, submitting, submitError } = useJobForm('create')

      expect(jobDraft.value.name).toBe('')
      expect(jobDraft.value.goalQuantity).toBe(1)
      expect(pathDrafts.value).toEqual([])
      expect(errors.value).toEqual([])
      expect(submitting.value).toBe(false)
      expect(submitError.value).toBeNull()
    })
  })

  // ---- Test 2: Submit in create mode calls createJob then createPath sequentially (Req 12.1) ----

  describe('create mode submission', () => {
    it('calls createJob then batch endpoint for all paths', async () => {
      const createdJob = makeJob({ id: 'new-job-id' })
      mockCreateJob.mockResolvedValue(createdJob)
      mockApi.mockResolvedValue({ created: [], updated: [], deleted: [] })

      const { jobDraft, pathDrafts, addPath, submit } = useJobForm('create')

      // Fill in valid job data
      jobDraft.value.name = 'My Job'
      jobDraft.value.goalQuantity = 50

      // Add two paths with steps
      addPath()
      addPath()
      pathDrafts.value[0].name = 'Path A'
      pathDrafts.value[0].steps[0].name = 'Step A1'
      pathDrafts.value[1].name = 'Path B'
      pathDrafts.value[1].steps[0].name = 'Step B1'

      const callOrder: string[] = []
      mockCreateJob.mockImplementation(async () => {
        callOrder.push('createJob')
        return createdJob
      })
      mockApi.mockImplementation(async () => {
        callOrder.push('batchPaths')
        return { created: [], updated: [], deleted: [] }
      })

      const jobId = await submit()

      expect(jobId).toBe('new-job-id')
      expect(callOrder).toEqual(['createJob', 'batchPaths'])
      expect(mockCreateJob).toHaveBeenCalledWith({
        name: 'My Job',
        goalQuantity: 50,
      })
      // Single batch call instead of N createPath calls
      expect(mockApi).toHaveBeenCalledTimes(1)
      expect(mockApi).toHaveBeenCalledWith(
        '/api/jobs/new-job-id/paths/batch',
        expect.objectContaining({
          method: 'POST',
          body: {
            create: expect.arrayContaining([
              expect.objectContaining({ name: 'Path A' }),
              expect.objectContaining({ name: 'Path B' }),
            ]),
          },
        }),
      )
      // createPath should NOT be called
      expect(mockCreatePath).not.toHaveBeenCalled()
    })
  })

  // ---- Test 3: Submit returns job id on success (Req 12.2) ----

  describe('submit returns job id on success', () => {
    it('returns the created job id in create mode', async () => {
      const createdJob = makeJob({ id: 'returned-id' })
      mockCreateJob.mockResolvedValue(createdJob)

      const { jobDraft, submit } = useJobForm('create')
      jobDraft.value.name = 'Valid Job'
      jobDraft.value.goalQuantity = 10

      const result = await submit()
      expect(result).toBe('returned-id')
    })

    it('returns the existing job id in edit mode', async () => {
      mockUpdateJob.mockResolvedValue({})

      const existingJob = makeExistingJob({ id: 'edit-job-id' })
      const { submit } = useJobForm('edit', existingJob)

      const result = await submit()
      expect(result).toBe('edit-job-id')
    })
  })

  // ---- Test 4: Submit shows error and preserves form on failure (Req 12.3) ----

  describe('submit error handling', () => {
    it('sets submitError and preserves form state when createJob throws', async () => {
      mockCreateJob.mockRejectedValue(new Error('Server error'))

      const { jobDraft, submitError, submitting, submit } = useJobForm('create')
      jobDraft.value.name = 'My Job'
      jobDraft.value.goalQuantity = 25

      await expect(submit()).rejects.toThrow('Server error')

      expect(submitError.value).toBe('Server error')
      expect(submitting.value).toBe(false)
      // Form state preserved
      expect(jobDraft.value.name).toBe('My Job')
      expect(jobDraft.value.goalQuantity).toBe(25)
    })

    it('sets submitError from e.data.message when available', async () => {
      const apiError = new Error('fail')
      ;(apiError as any).data = { message: 'Duplicate job name' }
      mockCreateJob.mockRejectedValue(apiError)

      const { jobDraft, submitError, submit } = useJobForm('create')
      jobDraft.value.name = 'Dup Job'
      jobDraft.value.goalQuantity = 1

      await expect(submit()).rejects.toThrow()
      expect(submitError.value).toBe('Duplicate job name')
    })

    it('sets submitting=true during execution and false after', async () => {
      let resolveCreate: (v: any) => void
      mockCreateJob.mockImplementation(() => new Promise((r) => {
        resolveCreate = r
      }))

      const { jobDraft, submitting, submit } = useJobForm('create')
      jobDraft.value.name = 'Job'
      jobDraft.value.goalQuantity = 1

      const promise = submit()
      // submitting should be true while awaiting
      expect(submitting.value).toBe(true)

      resolveCreate!(makeJob({ id: 'j1' }))
      await promise

      expect(submitting.value).toBe(false)
    })
  })

  // ---- Test 5: Edit submit with path deletion, update, and creation (Req 13.1, 13.2, 13.3) ----

  describe('edit mode submission with path changes', () => {
    it('calls batch endpoint with delete, update, and create arrays', async () => {
      const existingPaths: Path[] = [
        makePath('job-1', { id: 'path-keep', name: 'Keep Path', steps: [makeStep({ id: 's1', name: 'Step 1' })] }),
        makePath('job-1', { id: 'path-remove', name: 'Remove Path', steps: [makeStep({ id: 's2', name: 'Step 2' })] }),
      ]
      const existingJob = makeExistingJob({ id: 'job-1', name: 'Edit Job', goalQuantity: 50 }, existingPaths)

      mockUpdateJob.mockResolvedValue({})
      mockApi.mockResolvedValue({ created: [], updated: [], deleted: [] })

      const { pathDrafts, submit } = useJobForm('edit', existingJob)

      // Remove the second path (path-remove)
      const removeIdx = pathDrafts.value.findIndex(d => d._existingId === 'path-remove')
      pathDrafts.value.splice(removeIdx, 1)

      // Modify the first path (path-keep) — change its name
      pathDrafts.value[0].name = 'Updated Path'

      // Add a new path
      pathDrafts.value.push({
        _clientId: 'new-client-id',
        name: 'New Path',
        goalQuantity: 10,
        advancementMode: 'flexible',
        steps: [{ _clientId: 'new-step-id', name: 'New Step', location: '', assignedTo: '', optional: false, dependencyType: 'preferred' }],
      })

      const jobId = await submit()

      expect(jobId).toBe('job-1')
      expect(mockUpdateJob).toHaveBeenCalledWith('job-1', { name: 'Edit Job', goalQuantity: 50 })

      // Single batch call instead of individual deletePath/updatePath/createPath calls
      expect(mockApi).toHaveBeenCalledTimes(1)
      expect(mockApi).toHaveBeenCalledWith(
        '/api/jobs/job-1/paths/batch',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            delete: ['path-remove'],
            update: expect.arrayContaining([
              expect.objectContaining({ pathId: 'path-keep', name: 'Updated Path' }),
            ]),
            create: expect.arrayContaining([
              expect.objectContaining({ name: 'New Path', advancementMode: 'flexible' }),
            ]),
          }),
        }),
      )

      // Individual path methods should NOT be called
      expect(mockDeletePath).not.toHaveBeenCalled()
      expect(mockUpdatePath).not.toHaveBeenCalled()
      expect(mockCreatePath).not.toHaveBeenCalled()
    })
  })

  // ---- Test 6: Validation runs before any API calls (Req 14.1) ----

  describe('validation before API calls', () => {
    it('throws on validation failure without calling any API', async () => {
      const { submit } = useJobForm('create')
      // jobDraft.name is empty by default — invalid

      await expect(submit()).rejects.toThrow('Validation failed')

      expect(mockCreateJob).not.toHaveBeenCalled()
      expect(mockCreatePath).not.toHaveBeenCalled()
      expect(mockUpdateJob).not.toHaveBeenCalled()
      expect(mockUpdatePath).not.toHaveBeenCalled()
      expect(mockDeletePath).not.toHaveBeenCalled()
      expect(mockApi).not.toHaveBeenCalled()
    })

    it('rejects when a path has an empty name', async () => {
      const { jobDraft, addPath, submit } = useJobForm('create')
      jobDraft.value.name = 'Valid Job'
      jobDraft.value.goalQuantity = 5
      addPath()
      // pathDrafts[0].name is empty by default

      await expect(submit()).rejects.toThrow('Validation failed')
      expect(mockCreateJob).not.toHaveBeenCalled()
    })

    it('rejects when a step has an empty name', async () => {
      const { jobDraft, addPath, pathDrafts, submit } = useJobForm('create')
      jobDraft.value.name = 'Valid Job'
      jobDraft.value.goalQuantity = 5
      addPath()
      pathDrafts.value[0].name = 'Valid Path'
      // step name is empty by default

      await expect(submit()).rejects.toThrow('Validation failed')
      expect(mockCreateJob).not.toHaveBeenCalled()
    })
  })

  // ---- Test 7: hasPathChanges detects assignedTo differences (Req 9.1, 9.2) ----

  describe('hasPathChanges assignee change detection', () => {
    it('returns true when assignedTo differs between draft and original', () => {
      const originalPath = makePath('job-1', {
        id: 'path-1',
        name: 'Route A',
        goalQuantity: 10,
        advancementMode: 'strict',
        steps: [makeStep({ id: 's1', name: 'Step 1', assignedTo: 'user-1' })],
      })

      const draft: PathDraft = {
        _clientId: 'c1',
        _existingId: 'path-1',
        name: 'Route A',
        goalQuantity: 10,
        advancementMode: 'strict',
        steps: [{
          _clientId: 'cs1',
          _existingStepId: 's1',
          name: 'Step 1',
          location: '',
          assignedTo: 'user-2', // different from original 'user-1'
          optional: false,
          dependencyType: 'preferred',
        }],
      }

      const { toUpdate } = computePathChanges([originalPath], [draft])
      expect(toUpdate).toHaveLength(1)
      expect(toUpdate[0]._existingId).toBe('path-1')
    })

    it('returns false when assignedTo matches between draft and original', () => {
      const originalPath = makePath('job-1', {
        id: 'path-1',
        name: 'Route A',
        goalQuantity: 10,
        advancementMode: 'strict',
        steps: [makeStep({ id: 's1', name: 'Step 1', assignedTo: 'user-1' })],
      })

      const draft: PathDraft = {
        _clientId: 'c1',
        _existingId: 'path-1',
        name: 'Route A',
        goalQuantity: 10,
        advancementMode: 'strict',
        steps: [{
          _clientId: 'cs1',
          _existingStepId: 's1',
          name: 'Step 1',
          location: '',
          assignedTo: 'user-1', // same as original
          optional: false,
          dependencyType: 'preferred',
        }],
      }

      const { toUpdate } = computePathChanges([originalPath], [draft])
      expect(toUpdate).toHaveLength(0)
    })

    it('treats empty string assignedTo as matching undefined original', () => {
      const originalPath = makePath('job-1', {
        id: 'path-1',
        name: 'Route A',
        goalQuantity: 10,
        advancementMode: 'strict',
        steps: [makeStep({ id: 's1', name: 'Step 1' })], // no assignedTo (undefined)
      })

      const draft: PathDraft = {
        _clientId: 'c1',
        _existingId: 'path-1',
        name: 'Route A',
        goalQuantity: 10,
        advancementMode: 'strict',
        steps: [{
          _clientId: 'cs1',
          _existingStepId: 's1',
          name: 'Step 1',
          location: '',
          assignedTo: '', // empty string should match undefined
          optional: false,
          dependencyType: 'preferred',
        }],
      }

      const { toUpdate } = computePathChanges([originalPath], [draft])
      expect(toUpdate).toHaveLength(0)
    })
  })

  // ---- Test 8: createStepDraft defaults assignedTo to '' (Req 6.4) ----

  describe('createStepDraft defaults', () => {
    it('defaults assignedTo to empty string when adding a new step', () => {
      const { addPath, pathDrafts } = useJobForm('create')
      addPath()

      const step = pathDrafts.value[0].steps[0]
      expect(step.assignedTo).toBe('')
    })

    it('defaults assignedTo to empty string when adding a step to an existing path', () => {
      const { addPath, addStep, pathDrafts } = useJobForm('create')
      addPath()
      const pathClientId = pathDrafts.value[0]._clientId
      addStep(pathClientId)

      const newStep = pathDrafts.value[0].steps[1]
      expect(newStep.assignedTo).toBe('')
    })
  })

  // ---- Test 9: Edit mode hydration populates assignedTo from existing step (Req 10.1, 10.2) ----

  describe('edit mode hydration for assignedTo', () => {
    it('populates assignedTo from existing step', () => {
      const existingJob = makeExistingJob(
        { id: 'job-1', name: 'Test Job', goalQuantity: 100 },
        [makePath('job-1', {
          id: 'path-1',
          steps: [makeStep({ id: 's1', name: 'Step 1', assignedTo: 'user-42' })],
        })],
      )

      const { pathDrafts } = useJobForm('edit', existingJob)

      expect(pathDrafts.value[0].steps[0].assignedTo).toBe('user-42')
    })

    it('sets assignedTo to empty string when existing step has no assignedTo', () => {
      const existingJob = makeExistingJob(
        { id: 'job-1', name: 'Test Job', goalQuantity: 100 },
        [makePath('job-1', {
          id: 'path-1',
          steps: [makeStep({ id: 's1', name: 'Step 1' })], // no assignedTo
        })],
      )

      const { pathDrafts } = useJobForm('edit', existingJob)

      expect(pathDrafts.value[0].steps[0].assignedTo).toBe('')
    })

    it('hydrates multiple steps with their respective assignedTo values', () => {
      const existingJob = makeExistingJob(
        { id: 'job-1', name: 'Test Job', goalQuantity: 100 },
        [makePath('job-1', {
          id: 'path-1',
          steps: [
            makeStep({ id: 's1', name: 'Step 1', order: 0, assignedTo: 'user-a' }),
            makeStep({ id: 's2', name: 'Step 2', order: 1, assignedTo: undefined }),
            makeStep({ id: 's3', name: 'Step 3', order: 2, assignedTo: 'user-b' }),
          ],
        })],
      )

      const { pathDrafts } = useJobForm('edit', existingJob)

      expect(pathDrafts.value[0].steps[0].assignedTo).toBe('user-a')
      expect(pathDrafts.value[0].steps[1].assignedTo).toBe('')
      expect(pathDrafts.value[0].steps[2].assignedTo).toBe('user-b')
    })
  })
})
