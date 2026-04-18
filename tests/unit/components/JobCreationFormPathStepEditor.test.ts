/**
 * Unit tests for JobCreationForm with PathStepEditor integration.
 *
 * Uses a minimal defineComponent reproduction of the relevant logic
 * (no SFC parsing — no @vitejs/plugin-vue in vitest).
 *
 * Tests:
 * 1. PathStepEditor is rendered for each path draft
 * 2. Step mutations via PathStepEditor update the path draft's steps array
 *
 * Feature: unified-path-editor
 * Requirements: 1.4
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref, h, type PropType } from 'vue'
import { nanoid } from 'nanoid'
import type { StepDraft, PathDraft } from '~/app/composables/useJobForm'

// ── Helpers ──

function makeStep(overrides: Partial<StepDraft> = {}): StepDraft {
  return {
    _clientId: nanoid(),
    name: 'Step',
    location: '',
    assignedTo: '',
    optional: false,
    dependencyType: 'preferred',
    ...overrides,
  }
}

function makePathDraft(overrides: Partial<PathDraft> = {}): PathDraft {
  return {
    _clientId: nanoid(),
    name: 'Path',
    goalQuantity: 1,
    advancementMode: 'strict',
    steps: [makeStep()],
    ...overrides,
  }
}

/**
 * Mock PathStepEditor — renders a container per instance with step count,
 * and provides a trigger to emit update:steps.
 */
const MockPathStepEditor = defineComponent({
  name: 'PathStepEditor',
  props: {
    steps: { type: Array as PropType<StepDraft[]>, required: true },
    assigneeItems: { type: Array as PropType<{ label: string, value: string }[]>, default: () => [] },
    dependencyTypeOptions: { type: Array as PropType<{ label: string, value: string }[]>, default: () => [] },
    getFieldError: { type: Function, default: undefined },
    clearFieldError: { type: Function, default: undefined },
  },
  emits: ['update:steps'],
  setup(props, { emit }) {
    return () =>
      h('div', { class: 'mock-path-step-editor', 'data-testid': 'path-step-editor' }, [
        h('span', { 'data-testid': 'step-count' }, String(props.steps.length)),
        h('button', {
          'data-testid': 'emit-update-steps',
          onClick: () => {
            // Simulate adding a step via update:steps
            const newStep = makeStep({ name: 'New Step' })
            emit('update:steps', [...props.steps, newStep])
          },
        }, 'Emit Update'),
      ])
  },
})

/**
 * Minimal reproduction of JobCreationForm's path-level rendering logic.
 * Focuses on the v-for over pathDrafts and PathStepEditor integration.
 */
const JobCreationFormRepro = defineComponent({
  name: 'JobCreationFormRepro',
  props: {
    initialPathDrafts: { type: Array as PropType<PathDraft[]>, default: () => [] },
  },
  setup(props) {
    const pathDrafts = ref<PathDraft[]>([...props.initialPathDrafts])

    const assigneeItems = [{ label: 'Unassigned', value: '__unassigned__' }]
    const dependencyTypeOptions = [
      { label: 'Physical', value: 'physical' },
      { label: 'Preferred', value: 'preferred' },
      { label: 'Completion Gate', value: 'completion_gate' },
    ]

    function getFieldError(_field: string): string | undefined {
      return undefined
    }

    function clearFieldError(_field: string): void {}

    return () =>
      h('div', { 'data-testid': 'job-creation-form' }, [
        // Path count indicator for assertions
        h('span', { 'data-testid': 'path-count' }, String(pathDrafts.value.length)),

        // v-for path in pathDrafts — mirrors the real component
        ...pathDrafts.value.map((path, pathIndex) =>
          h('div', {
            key: path._clientId,
            class: 'path-card',
            'data-testid': `path-card-${pathIndex}`,
          }, [
            // Path name (for identification)
            h('span', { 'data-testid': `path-name-${pathIndex}` }, path.name),

            // PathStepEditor — the integration under test
            h(MockPathStepEditor, {
              steps: path.steps,
              assigneeItems,
              dependencyTypeOptions,
              getFieldError: (stepIdx: number, field: string) =>
                getFieldError(`paths[${pathIndex}].steps[${stepIdx}].${field}`),
              clearFieldError: (stepIdx: number, field: string) =>
                clearFieldError(`paths[${pathIndex}].steps[${stepIdx}].${field}`),
              'onUpdate:steps': (newSteps: StepDraft[]) => {
                pathDrafts.value[pathIndex]!.steps = newSteps
              },
            }),
          ]),
        ),
      ])
  },
})

// ── Mount helper ──

function mountForm(pathDrafts: PathDraft[] = []) {
  return mount(JobCreationFormRepro, {
    props: { initialPathDrafts: pathDrafts },
  })
}

// ── Tests ──

describe('JobCreationForm + PathStepEditor integration', () => {
  describe('PathStepEditor rendered per path draft (Req 1.4)', () => {
    it('renders zero PathStepEditor instances when no path drafts exist', () => {
      const wrapper = mountForm([])
      const editors = wrapper.findAll('[data-testid="path-step-editor"]')
      expect(editors).toHaveLength(0)
    })

    it('renders one PathStepEditor for a single path draft', () => {
      const wrapper = mountForm([makePathDraft()])
      const editors = wrapper.findAll('[data-testid="path-step-editor"]')
      expect(editors).toHaveLength(1)
    })

    it('renders N PathStepEditor instances for N path drafts', () => {
      const paths = [
        makePathDraft({ name: 'Path A' }),
        makePathDraft({ name: 'Path B' }),
        makePathDraft({ name: 'Path C' }),
      ]
      const wrapper = mountForm(paths)
      const editors = wrapper.findAll('[data-testid="path-step-editor"]')
      expect(editors).toHaveLength(3)
    })

    it('each PathStepEditor receives the correct steps from its path draft', () => {
      const stepA = makeStep({ name: 'Step A1' })
      const stepB1 = makeStep({ name: 'Step B1' })
      const stepB2 = makeStep({ name: 'Step B2' })
      const paths = [
        makePathDraft({ name: 'Path A', steps: [stepA] }),
        makePathDraft({ name: 'Path B', steps: [stepB1, stepB2] }),
      ]
      const wrapper = mountForm(paths)
      const stepCounts = wrapper.findAll('[data-testid="step-count"]')
      expect(stepCounts).toHaveLength(2)
      expect(stepCounts[0]!.text()).toBe('1')
      expect(stepCounts[1]!.text()).toBe('2')
    })
  })

  describe('step mutations via PathStepEditor update path draft (Req 1.4)', () => {
    it('updates the first path draft steps when PathStepEditor emits update:steps', async () => {
      const initialStep = makeStep({ name: 'Original' })
      const paths = [makePathDraft({ name: 'Path A', steps: [initialStep] })]
      const wrapper = mountForm(paths)

      // Before: 1 step
      expect(wrapper.find('[data-testid="step-count"]').text()).toBe('1')

      // Trigger update:steps from the mock PathStepEditor
      await wrapper.find('[data-testid="emit-update-steps"]').trigger('click')

      // After: 2 steps (original + new step added by mock)
      expect(wrapper.find('[data-testid="step-count"]').text()).toBe('2')
    })

    it('updates the correct path draft when multiple paths exist', async () => {
      const paths = [
        makePathDraft({ name: 'Path A', steps: [makeStep()] }),
        makePathDraft({ name: 'Path B', steps: [makeStep(), makeStep()] }),
      ]
      const wrapper = mountForm(paths)

      const stepCounts = wrapper.findAll('[data-testid="step-count"]')
      expect(stepCounts[0]!.text()).toBe('1')
      expect(stepCounts[1]!.text()).toBe('2')

      // Trigger update:steps on the second PathStepEditor (Path B)
      const emitButtons = wrapper.findAll('[data-testid="emit-update-steps"]')
      await emitButtons[1]!.trigger('click')

      // Path A unchanged, Path B gained a step
      const updatedCounts = wrapper.findAll('[data-testid="step-count"]')
      expect(updatedCounts[0]!.text()).toBe('1')
      expect(updatedCounts[1]!.text()).toBe('3')
    })
  })
})
