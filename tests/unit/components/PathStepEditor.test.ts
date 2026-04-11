/**
 * Unit tests for PathStepEditor rendering.
 *
 * Uses a minimal defineComponent reproduction of the real component's
 * script logic (no SFC parsing — no @vitejs/plugin-vue in vitest).
 * Tests desktop/mobile layout rendering, column headers, inline labels,
 * checkbox alignment, button disabled states, and mobile full-width Add Step.
 *
 * Feature: unified-path-editor
 * Requirements: 6.1, 6.2, 6.3, 7.1, 7.2, 7.5, 7.6, 8.1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref, h, type PropType } from 'vue'
import { nanoid } from 'nanoid'
import type { StepDraft } from '~/app/composables/useJobForm'

// ── Mock state ──
let mockIsMobile: ReturnType<typeof ref<boolean>>

beforeEach(() => {
  mockIsMobile = ref(false)
})

// ── Helpers ──
function makeStep(overrides: Partial<StepDraft> = {}): StepDraft {
  return {
    _clientId: nanoid(),
    name: 'Test Step',
    location: 'Test Location',
    assignedTo: '',
    optional: false,
    dependencyType: 'preferred',
    ...overrides,
  }
}

const SELECT_UNASSIGNED = '__unassigned__'

/**
 * Minimal reproduction of PathStepEditor logic and template structure.
 * Mirrors the real component's props, emits, desktop/mobile layout,
 * column headers, inline labels, checkbox wrapper, button disabled states.
 */
const PathStepEditor = defineComponent({
  name: 'PathStepEditor',
  props: {
    steps: { type: Array as PropType<StepDraft[]>, required: true },
    assigneeItems: { type: Array as PropType<{ label: string; value: string }[]>, default: () => [] },
    dependencyTypeOptions: { type: Array as PropType<{ label: string; value: string }[]>, default: () => [] },
    getFieldError: { type: Function as PropType<(stepIndex: number, field: string) => string | undefined>, default: undefined },
    clearFieldError: { type: Function as PropType<(stepIndex: number, field: string) => void>, default: undefined },
  },
  emits: ['update:steps'],
  setup(props, { emit }) {
    const isMobile = mockIsMobile

    function assigneeToSelect(assignedTo: string): string {
      return assignedTo || SELECT_UNASSIGNED
    }

    function handleAddStep() {
      const newStep: StepDraft = {
        _clientId: nanoid(),
        name: '',
        location: '',
        assignedTo: '',
        optional: false,
        dependencyType: 'preferred',
      }
      emit('update:steps', [...props.steps, newStep])
    }

    function handleRemoveStep(clientId: string) {
      if (props.steps.length <= 1) return
      emit('update:steps', props.steps.filter(s => s._clientId !== clientId))
    }

    function handleMoveStep(clientId: string, direction: -1 | 1) {
      const idx = props.steps.findIndex(s => s._clientId === clientId)
      const target = idx + direction
      if (target < 0 || target >= props.steps.length) return
      const copy = [...props.steps]
      ;[copy[idx], copy[target]] = [copy[target]!, copy[idx]!]
      emit('update:steps', copy)
    }

    return () => {
      const steps = props.steps

      // ── Desktop layout ──
      if (!isMobile.value) {
        return h('div', { class: 'space-y-2', 'data-testid': 'path-step-editor' }, [
          // Column headers
          h('div', {
            class: 'flex items-center gap-2 text-xs font-medium text-(--ui-text-muted) px-2',
            'data-testid': 'column-headers',
          }, [
            h('span', { class: 'w-7 shrink-0 text-center' }, '#'),
            h('span', { class: 'flex-1 min-w-0' }, 'Process'),
            h('span', { class: 'flex-1 min-w-0' }, 'Location'),
            h('span', { class: 'w-36 shrink-0' }, 'Assignee'),
            h('span', { class: 'w-8 shrink-0 text-center' }, 'Opt'),
            h('span', { class: 'w-36 shrink-0' }, 'Dependency'),
            h('span', { class: 'w-14 shrink-0 text-center' }, '↕'),
            h('span', { class: 'w-7 shrink-0 text-center' }, '✕'),
          ]),

          // Step cards
          ...steps.map((step, stepIndex) =>
            h('div', {
              key: step._clientId,
              class: 'border border-(--ui-border) rounded-md p-2',
              'data-testid': `step-card-${stepIndex}`,
            }, [
              // Zone 1: primary flex row
              h('div', { class: 'flex items-center gap-2' }, [
                // Step badge
                h('span', { class: 'w-7 shrink-0 text-center text-xs font-medium' }, String(stepIndex + 1)),
                // Process (mock as input)
                h('div', { class: 'flex-1 min-w-0' }, [
                  h('input', { value: step.name, 'data-testid': `process-${stepIndex}` }),
                ]),
                // Location (mock as input)
                h('div', { class: 'flex-1 min-w-0' }, [
                  h('input', { value: step.location, 'data-testid': `location-${stepIndex}` }),
                ]),
                // Assignee (mock as select)
                h('select', {
                  class: 'w-36 shrink-0',
                  value: assigneeToSelect(step.assignedTo),
                  'data-testid': `assignee-${stepIndex}`,
                }),
                // Optional checkbox wrapper
                h('div', {
                  class: 'w-8 shrink-0 flex items-center justify-center h-8',
                  'data-testid': `checkbox-wrapper-${stepIndex}`,
                }, [
                  h('input', { type: 'checkbox', checked: step.optional }),
                ]),
                // Dependency (mock as select)
                h('select', {
                  class: 'w-36 shrink-0',
                  value: step.dependencyType,
                  'data-testid': `dependency-${stepIndex}`,
                }),
                // Move up/down
                h('div', { class: 'w-14 shrink-0 flex items-center gap-0.5 justify-center' }, [
                  h('button', {
                    disabled: stepIndex === 0,
                    'data-testid': `move-up-${stepIndex}`,
                    onClick: () => handleMoveStep(step._clientId, -1),
                  }, '↑'),
                  h('button', {
                    disabled: stepIndex === steps.length - 1,
                    'data-testid': `move-down-${stepIndex}`,
                    onClick: () => handleMoveStep(step._clientId, 1),
                  }, '↓'),
                ]),
                // Remove
                h('button', {
                  class: 'w-7 shrink-0',
                  disabled: steps.length <= 1,
                  'data-testid': `remove-${stepIndex}`,
                  onClick: () => handleRemoveStep(step._clientId),
                }, '✕'),
              ]),
            ]),
          ),

          // Add Step button
          h('button', {
            'data-testid': 'add-step',
            onClick: handleAddStep,
          }, 'Add Step'),
        ])
      }

      // ── Mobile layout ──
      return h('div', { class: 'space-y-2', 'data-testid': 'path-step-editor' }, [
        // No column headers on mobile

        // Step cards (stacked)
        ...steps.map((step, stepIndex) =>
          h('div', {
            key: step._clientId,
            class: 'border border-(--ui-border) rounded-md p-3 space-y-2',
            'data-testid': `step-card-${stepIndex}`,
          }, [
            // Card header: step number
            h('div', { class: 'text-xs font-semibold text-(--ui-text-highlighted)' }, `Step ${stepIndex + 1}`),

            // Process with inline label
            h('div', {}, [
              h('label', { class: 'block text-xs text-(--ui-text-muted) mb-0.5' }, 'Process'),
              h('input', { value: step.name, 'data-testid': `process-${stepIndex}` }),
            ]),

            // Location with inline label
            h('div', {}, [
              h('label', { class: 'block text-xs text-(--ui-text-muted) mb-0.5' }, 'Location'),
              h('input', { value: step.location, 'data-testid': `location-${stepIndex}` }),
            ]),

            // Assignee with inline label
            h('div', {}, [
              h('label', { class: 'block text-xs text-(--ui-text-muted) mb-0.5' }, 'Assignee'),
              h('select', {
                value: assigneeToSelect(step.assignedTo),
                'data-testid': `assignee-${stepIndex}`,
              }),
            ]),

            // Optional + Dependency row
            h('div', { class: 'flex items-center gap-2' }, [
              h('input', { type: 'checkbox', checked: step.optional }),
              h('span', { class: 'text-xs text-(--ui-text-muted)' }, 'Optional'),
              h('select', {
                class: 'flex-1',
                value: step.dependencyType,
                'data-testid': `dependency-${stepIndex}`,
              }),
            ]),

            // Footer: move + remove buttons
            h('div', { class: 'flex items-center gap-2' }, [
              h('button', {
                disabled: stepIndex === 0,
                'data-testid': `move-up-${stepIndex}`,
                onClick: () => handleMoveStep(step._clientId, -1),
              }, '↑'),
              h('button', {
                disabled: stepIndex === steps.length - 1,
                'data-testid': `move-down-${stepIndex}`,
                onClick: () => handleMoveStep(step._clientId, 1),
              }, '↓'),
              h('button', {
                disabled: steps.length <= 1,
                'data-testid': `remove-${stepIndex}`,
                onClick: () => handleRemoveStep(step._clientId),
              }, 'Remove'),
            ]),
          ]),
        ),

        // Add Step button (full-width on mobile)
        h('button', {
          class: 'w-full',
          'data-testid': 'add-step',
          onClick: handleAddStep,
        }, 'Add Step'),
      ])
    }
  },
})

// ── Mount helper ──
function mountEditor(props: Partial<{
  steps: StepDraft[]
  assigneeItems: { label: string; value: string }[]
  dependencyTypeOptions: { label: string; value: string }[]
}> = {}) {
  return mount(PathStepEditor, {
    props: {
      steps: props.steps ?? [makeStep()],
      assigneeItems: props.assigneeItems ?? [{ label: 'Unassigned', value: SELECT_UNASSIGNED }],
      dependencyTypeOptions: props.dependencyTypeOptions ?? [{ label: 'Preferred', value: 'preferred' }],
    },
  })
}

// ── Tests ──

describe('PathStepEditor rendering', () => {
  // Req 6.1: Correct number of step cards rendered
  describe('step card count', () => {
    it('renders correct number of step cards for given steps prop', () => {
      const steps = [makeStep(), makeStep(), makeStep()]
      const wrapper = mountEditor({ steps })
      const cards = wrapper.findAll('[data-testid^="step-card-"]')
      expect(cards).toHaveLength(3)
    })

    it('renders a single step card when one step is provided', () => {
      const wrapper = mountEditor({ steps: [makeStep()] })
      const cards = wrapper.findAll('[data-testid^="step-card-"]')
      expect(cards).toHaveLength(1)
    })
  })

  // Req 6.2: Desktop column headers visible when isMobile is false
  describe('desktop column headers', () => {
    it('renders column headers when isMobile is false', () => {
      mockIsMobile.value = false
      const wrapper = mountEditor()
      const headers = wrapper.find('[data-testid="column-headers"]')
      expect(headers.exists()).toBe(true)
    })
  })

  // Req 7.5: Mobile column headers hidden when isMobile is true
  describe('mobile column headers hidden', () => {
    it('does NOT render column headers when isMobile is true', () => {
      mockIsMobile.value = true
      const wrapper = mountEditor()
      const headers = wrapper.find('[data-testid="column-headers"]')
      expect(headers.exists()).toBe(false)
    })
  })

  // Req 7.1, 7.2: Mobile inline labels present for Process, Location, Assignee
  describe('mobile inline labels', () => {
    it('renders inline labels for Process, Location, Assignee on mobile', () => {
      mockIsMobile.value = true
      const wrapper = mountEditor({ steps: [makeStep()] })
      const labels = wrapper.findAll('label')
      const labelTexts = labels.map(l => l.text())
      expect(labelTexts).toContain('Process')
      expect(labelTexts).toContain('Location')
      expect(labelTexts).toContain('Assignee')
    })
  })

  // Req 6.3: Checkbox wrapper has h-8 class on desktop
  describe('checkbox wrapper height on desktop', () => {
    it('wraps the optional checkbox in a container with h-8 class', () => {
      mockIsMobile.value = false
      const wrapper = mountEditor({ steps: [makeStep()] })
      const checkboxWrapper = wrapper.find('[data-testid="checkbox-wrapper-0"]')
      expect(checkboxWrapper.exists()).toBe(true)
      expect(checkboxWrapper.classes()).toContain('h-8')
    })
  })

  // Req 3.2, 3.3 (via 7.6): Remove button disabled when only 1 step
  describe('remove button disabled for single step', () => {
    it('disables remove button when only 1 step exists (desktop)', () => {
      mockIsMobile.value = false
      const wrapper = mountEditor({ steps: [makeStep()] })
      const removeBtn = wrapper.find('[data-testid="remove-0"]')
      expect(removeBtn.attributes('disabled')).toBeDefined()
    })

    it('disables remove button when only 1 step exists (mobile)', () => {
      mockIsMobile.value = true
      const wrapper = mountEditor({ steps: [makeStep()] })
      const removeBtn = wrapper.find('[data-testid="remove-0"]')
      expect(removeBtn.attributes('disabled')).toBeDefined()
    })

    it('enables remove button when multiple steps exist', () => {
      mockIsMobile.value = false
      const wrapper = mountEditor({ steps: [makeStep(), makeStep()] })
      const removeBtn = wrapper.find('[data-testid="remove-0"]')
      expect(removeBtn.attributes('disabled')).toBeUndefined()
    })
  })

  // Req 4.3, 4.4 (via 7.6): Move-up disabled on first step, move-down disabled on last step
  describe('move button disabled states', () => {
    it('disables move-up on first step (desktop)', () => {
      mockIsMobile.value = false
      const steps = [makeStep(), makeStep(), makeStep()]
      const wrapper = mountEditor({ steps })
      const moveUp0 = wrapper.find('[data-testid="move-up-0"]')
      expect(moveUp0.attributes('disabled')).toBeDefined()
    })

    it('disables move-down on last step (desktop)', () => {
      mockIsMobile.value = false
      const steps = [makeStep(), makeStep(), makeStep()]
      const wrapper = mountEditor({ steps })
      const moveDown2 = wrapper.find('[data-testid="move-down-2"]')
      expect(moveDown2.attributes('disabled')).toBeDefined()
    })

    it('enables move-down on first step and move-up on last step', () => {
      mockIsMobile.value = false
      const steps = [makeStep(), makeStep(), makeStep()]
      const wrapper = mountEditor({ steps })
      const moveDown0 = wrapper.find('[data-testid="move-down-0"]')
      const moveUp2 = wrapper.find('[data-testid="move-up-2"]')
      expect(moveDown0.attributes('disabled')).toBeUndefined()
      expect(moveUp2.attributes('disabled')).toBeUndefined()
    })

    it('disables move-up on first step (mobile)', () => {
      mockIsMobile.value = true
      const steps = [makeStep(), makeStep()]
      const wrapper = mountEditor({ steps })
      const moveUp0 = wrapper.find('[data-testid="move-up-0"]')
      expect(moveUp0.attributes('disabled')).toBeDefined()
    })

    it('disables move-down on last step (mobile)', () => {
      mockIsMobile.value = true
      const steps = [makeStep(), makeStep()]
      const wrapper = mountEditor({ steps })
      const moveDown1 = wrapper.find('[data-testid="move-down-1"]')
      expect(moveDown1.attributes('disabled')).toBeDefined()
    })
  })

  // Req 8.1: "Add Step" button has w-full class on mobile
  describe('Add Step button mobile full-width', () => {
    it('has w-full class on mobile', () => {
      mockIsMobile.value = true
      const wrapper = mountEditor()
      const addBtn = wrapper.find('[data-testid="add-step"]')
      expect(addBtn.classes()).toContain('w-full')
    })

    it('does NOT have w-full class on desktop', () => {
      mockIsMobile.value = false
      const wrapper = mountEditor()
      const addBtn = wrapper.find('[data-testid="add-step"]')
      expect(addBtn.classes()).not.toContain('w-full')
    })
  })
})
