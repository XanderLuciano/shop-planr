/**
 * Unit tests for Job Detail Page ([id].vue) PathStepEditor integration.
 *
 * Uses a minimal defineComponent reproduction of the relevant logic
 * (no SFC parsing — no @vitejs/plugin-vue in vitest).
 *
 * Tests:
 * 1. Editing a path populates PathStepEditor with converted StepDraft[]
 * 2. Save calls updatePath with correctly converted payload
 * 3. New path creation calls createPath with correct payload
 * 4. Save error keeps editing state intact
 *
 * Feature: unified-path-editor
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref, h, computed, type PropType } from 'vue'
import type { ProcessStep, Path } from '~/server/types/domain'
import type { StepDraft } from '~/app/composables/useJobForm'
import { createStepDraft } from '~/app/composables/useJobForm'
import { toStepDrafts, toStepPayload } from '~/app/utils/stepDraftHelpers'

// ── Helpers ──

function makeProcessStep(overrides: Partial<ProcessStep> = {}): ProcessStep {
  return {
    id: overrides.id ?? `step-${Math.random().toString(36).slice(2, 8)}`,
    name: overrides.name ?? 'Heat Treat',
    order: overrides.order ?? 1,
    location: overrides.location ?? 'Bay A',
    assignedTo: overrides.assignedTo ?? 'user-1',
    optional: overrides.optional ?? false,
    dependencyType: overrides.dependencyType ?? 'preferred',
    removedAt: undefined,
    completedCount: overrides.completedCount ?? 0,
  }
}

function makePath(overrides: Partial<Path> = {}): Path {
  return {
    id: overrides.id ?? `path-${Math.random().toString(36).slice(2, 8)}`,
    jobId: overrides.jobId ?? 'job-1',
    name: overrides.name ?? 'Standard Route',
    goalQuantity: overrides.goalQuantity ?? 10,
    steps: overrides.steps ?? [
      makeProcessStep({ order: 1, name: 'Step A' }),
      makeProcessStep({ order: 2, name: 'Step B' }),
    ],
    advancementMode: overrides.advancementMode ?? 'strict',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  }
}

// ── Mock PathStepEditor ──

const MockPathStepEditor = defineComponent({
  name: 'PathStepEditor',
  props: {
    steps: { type: Array as PropType<StepDraft[]>, required: true },
  },
  emits: ['update:steps'],
  setup(props) {
    return () =>
      h('div', { 'data-testid': 'path-step-editor' }, [
        h('span', { 'data-testid': 'step-count' }, String(props.steps.length)),
      ])
  },
})

// ── Minimal reproduction of jobs/[id].vue editing logic ──

/**
 * Reproduces the path editing state management from jobs/[id].vue.
 * Accepts mock updatePath/createPath functions as props so we can
 * assert on calls and simulate errors.
 */
const JobDetailRepro = defineComponent({
  name: 'JobDetailRepro',
  props: {
    paths: { type: Array as PropType<Path[]>, default: () => [] },
    updatePathFn: { type: Function as PropType<(id: string, input: unknown) => Promise<unknown>>, required: true },
    createPathFn: { type: Function as PropType<(input: unknown) => Promise<unknown>>, required: true },
  },
  setup(props) {
    // Edit path state (mirrors jobs/[id].vue)
    const editingPathId = ref<string | null>(null)
    const editPathName = ref('')
    const editGoalQty = ref(1)
    const editSteps = ref<StepDraft[]>([])
    const saving = ref(false)
    const saveError = ref<string | null>(null)

    // New path state
    const showNewPath = ref(false)
    const newPathName = ref('')
    const newGoalQty = ref(1)
    const newPathSteps = ref<StepDraft[]>([createStepDraft()])

    function startEditPath(path: Path) {
      editingPathId.value = path.id
      editPathName.value = path.name
      editGoalQty.value = path.goalQuantity
      editSteps.value = toStepDrafts(path.steps as ProcessStep[])
      saveError.value = null
    }

    function cancelEdit() {
      editingPathId.value = null
      saveError.value = null
    }

    async function savePathEdit() {
      saving.value = true
      saveError.value = null
      try {
        await props.updatePathFn(editingPathId.value!, {
          name: editPathName.value.trim(),
          goalQuantity: editGoalQty.value,
          steps: toStepPayload(editSteps.value),
        })
        editingPathId.value = null
      } catch (e: unknown) {
        const err = e as { data?: { message?: string }, message?: string }
        saveError.value = err?.data?.message || err?.message || 'Failed to save path'
      } finally {
        saving.value = false
      }
    }

    async function saveNewPath() {
      saving.value = true
      saveError.value = null
      try {
        await props.createPathFn({
          jobId: 'job-1',
          name: newPathName.value.trim(),
          goalQuantity: newGoalQty.value,
          steps: toStepPayload(newPathSteps.value),
        })
        showNewPath.value = false
        newPathName.value = ''
        newGoalQty.value = 1
        newPathSteps.value = [createStepDraft()]
      } catch (e: unknown) {
        const err = e as { data?: { message?: string }, message?: string }
        saveError.value = err?.data?.message || err?.message || 'Failed to create path'
      } finally {
        saving.value = false
      }
    }

    const isEditing = computed(() => editingPathId.value !== null)

    return () =>
      h('div', { 'data-testid': 'job-detail' }, [
        // Expose state for assertions
        h('span', { 'data-testid': 'editing-path-id' }, editingPathId.value ?? ''),
        h('span', { 'data-testid': 'save-error' }, saveError.value ?? ''),
        h('span', { 'data-testid': 'saving' }, String(saving.value)),
        h('span', { 'data-testid': 'show-new-path' }, String(showNewPath.value)),

        // Edit path section
        isEditing.value
          ? h('div', { 'data-testid': 'edit-section' }, [
              h('span', { 'data-testid': 'edit-path-name' }, editPathName.value),
              h('span', { 'data-testid': 'edit-goal-qty' }, String(editGoalQty.value)),
              h(MockPathStepEditor, {
                steps: editSteps.value,
                'onUpdate:steps': (s: StepDraft[]) => { editSteps.value = s },
              }),
              h('button', { 'data-testid': 'save-btn', onClick: savePathEdit }, 'Save'),
              h('button', { 'data-testid': 'cancel-btn', onClick: cancelEdit }, 'Cancel'),
            ])
          : null,

        // New path section
        h('button', {
          'data-testid': 'start-new-path-btn',
          onClick: () => { showNewPath.value = true },
        }, 'Add Path'),

        showNewPath.value
          ? h('div', { 'data-testid': 'new-path-section' }, [
              h(MockPathStepEditor, {
                steps: newPathSteps.value,
                'onUpdate:steps': (s: StepDraft[]) => { newPathSteps.value = s },
              }),
              h('button', { 'data-testid': 'create-btn', onClick: saveNewPath }, 'Create'),
            ])
          : null,

        // Path list with edit buttons
        ...props.paths.map(p =>
          h('div', { key: p.id, 'data-testid': `path-card-${p.id}` }, [
            h('span', { 'data-testid': `path-name-${p.id}` }, p.name),
            h('button', {
              'data-testid': `edit-btn-${p.id}`,
              onClick: () => startEditPath(p),
            }, 'Edit'),
          ]),
        ),
      ])
  },
})

// ── Mount helper ──

function mountDetail(options: {
  paths?: Path[]
  updatePathFn?: (id: string, input: unknown) => Promise<unknown>
  createPathFn?: (input: unknown) => Promise<unknown>
} = {}) {
  return mount(JobDetailRepro, {
    props: {
      paths: options.paths ?? [],
      updatePathFn: options.updatePathFn ?? vi.fn().mockResolvedValue({}),
      createPathFn: options.createPathFn ?? vi.fn().mockResolvedValue({}),
    },
  })
}

// ── Tests ──

describe('Job Detail Page + PathStepEditor integration', () => {
  describe('Editing a path populates PathStepEditor with converted StepDraft[] (Req 13.1)', () => {
    it('startEditPath converts Path.steps to StepDraft[] via toStepDrafts', async () => {
      const path = makePath({
        id: 'path-1',
        name: 'Route Alpha',
        goalQuantity: 5,
        steps: [
          makeProcessStep({ id: 'ps-1', order: 2, name: 'QC Inspect', location: 'Lab' }),
          makeProcessStep({ id: 'ps-2', order: 1, name: 'Heat Treat', location: 'Bay A' }),
        ],
      })

      const wrapper = mountDetail({ paths: [path] })

      // Click edit on the path
      await wrapper.find('[data-testid="edit-btn-path-1"]').trigger('click')

      // Verify editing state is set
      expect(wrapper.find('[data-testid="editing-path-id"]').text()).toBe('path-1')
      expect(wrapper.find('[data-testid="edit-path-name"]').text()).toBe('Route Alpha')
      expect(wrapper.find('[data-testid="edit-goal-qty"]').text()).toBe('5')

      // PathStepEditor should have 2 steps (sorted by order)
      expect(wrapper.find('[data-testid="step-count"]').text()).toBe('2')
    })

    it('toStepDrafts sorts steps by order and assigns _clientId and _existingStepId', () => {
      const steps: ProcessStep[] = [
        makeProcessStep({ id: 'ps-3', order: 3, name: 'Ship' }),
        makeProcessStep({ id: 'ps-1', order: 1, name: 'Cut' }),
        makeProcessStep({ id: 'ps-2', order: 2, name: 'Weld' }),
      ]

      const drafts = toStepDrafts(steps)

      expect(drafts).toHaveLength(3)
      // Sorted by order
      expect(drafts[0]!.name).toBe('Cut')
      expect(drafts[1]!.name).toBe('Weld')
      expect(drafts[2]!.name).toBe('Ship')
      // _existingStepId preserved
      expect(drafts[0]!._existingStepId).toBe('ps-1')
      expect(drafts[1]!._existingStepId).toBe('ps-2')
      expect(drafts[2]!._existingStepId).toBe('ps-3')
      // _clientId assigned and unique
      const clientIds = drafts.map(d => d._clientId)
      expect(new Set(clientIds).size).toBe(3)
      clientIds.forEach(id => expect(id).toBeTruthy())
    })

    it('toStepDrafts normalizes null/undefined fields to defaults', () => {
      // Build a step with explicitly undefined optional fields
      const rawStep: ProcessStep = {
        id: 'ps-1',
        name: 'Step',
        order: 1,
        optional: false,
        dependencyType: 'preferred',
        completedCount: 0,
        // location, assignedTo intentionally omitted → undefined
      }

      const drafts = toStepDrafts([rawStep])
      expect(drafts[0]!.location).toBe('')
      expect(drafts[0]!.assignedTo).toBe('')
      expect(drafts[0]!.optional).toBe(false)
      expect(drafts[0]!.dependencyType).toBe('preferred')
    })
  })

  describe('Save calls updatePath with correctly converted payload (Req 13.3)', () => {
    let mockUpdatePath: ReturnType<typeof vi.fn>

    beforeEach(() => {
      mockUpdatePath = vi.fn().mockResolvedValue({})
    })

    it('savePathEdit calls updatePath with toStepPayload conversion', async () => {
      const path = makePath({
        id: 'path-1',
        name: 'Route Alpha',
        goalQuantity: 5,
        steps: [
          makeProcessStep({ id: 'ps-1', order: 1, name: '  Heat Treat  ', location: '  Bay A  ', assignedTo: 'user-1' }),
          makeProcessStep({ id: 'ps-2', order: 2, name: 'QC Inspect', location: '', assignedTo: '' }),
        ],
      })

      const wrapper = mountDetail({ paths: [path], updatePathFn: mockUpdatePath })

      // Start editing
      await wrapper.find('[data-testid="edit-btn-path-1"]').trigger('click')

      // Click save
      await wrapper.find('[data-testid="save-btn"]').trigger('click')
      // Wait for async save
      await vi.waitFor(() => {
        expect(mockUpdatePath).toHaveBeenCalledTimes(1)
      })

      const [pathId, payload] = mockUpdatePath.mock.calls[0]!
      expect(pathId).toBe('path-1')
      expect(payload.name).toBe('Route Alpha')
      expect(payload.goalQuantity).toBe(5)
      expect(payload.steps).toHaveLength(2)

      // Verify toStepPayload conversion: name trimmed, id = _existingStepId
      const step0 = payload.steps[0]
      expect(step0.id).toBe('ps-1')
      expect(step0.name).toBe('Heat Treat')
      expect(step0.location).toBe('Bay A')
      expect(step0.assignedTo).toBe('user-1')

      // Step with empty assignedTo and existing id → null
      const step1 = payload.steps[1]
      expect(step1.id).toBe('ps-2')
      expect(step1.name).toBe('QC Inspect')
      expect(step1.location).toBeUndefined() // empty → undefined
      expect(step1.assignedTo).toBeNull() // falsy + existing → null
    })

    it('clears editingPathId on successful save', async () => {
      const path = makePath({ id: 'path-1' })
      const wrapper = mountDetail({ paths: [path], updatePathFn: mockUpdatePath })

      await wrapper.find('[data-testid="edit-btn-path-1"]').trigger('click')
      expect(wrapper.find('[data-testid="editing-path-id"]').text()).toBe('path-1')

      await wrapper.find('[data-testid="save-btn"]').trigger('click')
      await vi.waitFor(() => {
        expect(wrapper.find('[data-testid="editing-path-id"]').text()).toBe('')
      })
    })
  })

  describe('New path creation calls createPath with correct payload (Req 13.2, 13.3)', () => {
    let mockCreatePath: ReturnType<typeof vi.fn>

    beforeEach(() => {
      mockCreatePath = vi.fn().mockResolvedValue({})
    })

    it('saveNewPath calls createPath with toStepPayload conversion', async () => {
      const wrapper = mountDetail({ createPathFn: mockCreatePath })

      // Open new path form
      await wrapper.find('[data-testid="start-new-path-btn"]').trigger('click')
      expect(wrapper.find('[data-testid="new-path-section"]').exists()).toBe(true)

      // The new path starts with one empty step (from createStepDraft)
      expect(wrapper.find('[data-testid="step-count"]').text()).toBe('1')

      // Click create
      await wrapper.find('[data-testid="create-btn"]').trigger('click')
      await vi.waitFor(() => {
        expect(mockCreatePath).toHaveBeenCalledTimes(1)
      })

      const [payload] = mockCreatePath.mock.calls[0]!
      expect(payload.jobId).toBe('job-1')
      expect(payload.name).toBe('')
      expect(payload.goalQuantity).toBe(1)
      expect(payload.steps).toHaveLength(1)

      // New step has no _existingStepId → id is undefined
      const step = payload.steps[0]
      expect(step.id).toBeUndefined()
      expect(step.name).toBe('')
      // falsy assignedTo + no existing → undefined
      expect(step.assignedTo).toBeUndefined()
    })

    it('resets new path state after successful creation', async () => {
      const wrapper = mountDetail({ createPathFn: mockCreatePath })

      await wrapper.find('[data-testid="start-new-path-btn"]').trigger('click')
      await wrapper.find('[data-testid="create-btn"]').trigger('click')

      await vi.waitFor(() => {
        expect(wrapper.find('[data-testid="show-new-path"]').text()).toBe('false')
      })
    })
  })

  describe('Save error keeps editing state intact (Req 13.4)', () => {
    it('updatePath failure preserves editingPathId and sets saveError', async () => {
      const mockUpdatePath = vi.fn().mockRejectedValue(new Error('Network error'))
      const path = makePath({ id: 'path-1', name: 'Route Alpha' })
      const wrapper = mountDetail({ paths: [path], updatePathFn: mockUpdatePath })

      // Start editing
      await wrapper.find('[data-testid="edit-btn-path-1"]').trigger('click')
      expect(wrapper.find('[data-testid="editing-path-id"]').text()).toBe('path-1')

      // Attempt save (will fail)
      await wrapper.find('[data-testid="save-btn"]').trigger('click')

      await vi.waitFor(() => {
        // editingPathId should still be set (not cleared)
        expect(wrapper.find('[data-testid="editing-path-id"]').text()).toBe('path-1')
        // saveError should be set
        expect(wrapper.find('[data-testid="save-error"]').text()).toBe('Network error')
      })

      // Edit section should still be visible for retry
      expect(wrapper.find('[data-testid="edit-section"]').exists()).toBe(true)
    })

    it('createPath failure preserves new path state and sets saveError', async () => {
      const mockCreatePath = vi.fn().mockRejectedValue({
        data: { message: 'Validation failed' },
      })
      const wrapper = mountDetail({ createPathFn: mockCreatePath })

      await wrapper.find('[data-testid="start-new-path-btn"]').trigger('click')
      await wrapper.find('[data-testid="create-btn"]').trigger('click')

      await vi.waitFor(() => {
        // showNewPath should still be true
        expect(wrapper.find('[data-testid="show-new-path"]').text()).toBe('true')
        // saveError should be set
        expect(wrapper.find('[data-testid="save-error"]').text()).toBe('Validation failed')
      })

      // New path section should still be visible for retry
      expect(wrapper.find('[data-testid="new-path-section"]').exists()).toBe(true)
    })

    it('saving flag resets to false after error', async () => {
      const mockUpdatePath = vi.fn().mockRejectedValue(new Error('Server error'))
      const path = makePath({ id: 'path-1' })
      const wrapper = mountDetail({ paths: [path], updatePathFn: mockUpdatePath })

      await wrapper.find('[data-testid="edit-btn-path-1"]').trigger('click')
      await wrapper.find('[data-testid="save-btn"]').trigger('click')

      await vi.waitFor(() => {
        expect(wrapper.find('[data-testid="saving"]').text()).toBe('false')
      })
    })
  })
})
