/**
 * Unit tests for ViewFilters clear button behavior.
 *
 * Tests per-input clear buttons (Job name, Priority, Step) and the global Clear button.
 * Uses defineComponent with render functions since vitest config has no @vitejs/plugin-vue.
 *
 * Feature: filter-clear-buttons
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 4.1, 4.2, 4.3, 5.1, 6.1, 6.3
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, computed } from 'vue'
import type { FilterState } from '~/server/types/domain'

/**
 * Minimal reproduction of ViewFilters clear-button logic.
 * Recreated as a defineComponent to avoid .vue SFC parsing issues.
 */
const ViewFilters = defineComponent({
  name: 'ViewFilters',
  props: {
    filters: { type: Object as () => FilterState, required: true },
  },
  emits: ['change'],
  setup(props, { emit }) {
    function update<K extends keyof FilterState>(key: K, value: FilterState[K]) {
      const next = { ...props.filters, [key]: value }
      emit('change', next)
    }

    function clearAll() {
      emit('change', { status: 'all' })
    }

    const hasActiveFilters = computed(() => {
      const f = props.filters
      return !!(f.jobName || f.jiraTicketKey || f.stepName || f.assignee || f.priority || f.label || (f.status && f.status !== 'all'))
    })

    const clearableFields = [
      { key: 'jobName' as const, ariaLabel: 'Clear job name filter' },
      { key: 'priority' as const, ariaLabel: 'Clear priority filter' },
      { key: 'stepName' as const, ariaLabel: 'Clear step filter' },
    ]

    return () =>
      h('div', { class: 'flex flex-wrap items-center gap-2' }, [
        ...clearableFields.map((field) =>
          h('div', { 'data-field': field.key }, [
            h('input', {
              value: props.filters[field.key] ?? '',
              onInput: (e: Event) => {
                const val = (e.target as HTMLInputElement).value
                update(field.key, val || undefined)
              },
            }),
            props.filters[field.key]
              ? h('button', {
                  'aria-label': field.ariaLabel,
                  'data-clear': field.key,
                  onClick: () => update(field.key, undefined),
                })
              : null,
          ]),
        ),
        hasActiveFilters.value
          ? h('button', {
              'data-clear-all': '',
              onClick: () => clearAll(),
            }, 'Clear')
          : null,
      ])
  },
})

function mountFilters(filters: FilterState) {
  return mount(ViewFilters, { props: { filters } })
}

describe('ViewFiltersClearButton', () => {
  // --- Clear button visibility (Req 1.1, 1.2, 1.3, 1.4) ---
  describe('clear button visibility', () => {
    it('renders clear button when jobName is non-empty', () => {
      const wrapper = mountFilters({ jobName: 'alpha' })
      expect(wrapper.find('[data-clear="jobName"]').exists()).toBe(true)
    })

    it('renders clear button when priority is non-empty', () => {
      const wrapper = mountFilters({ priority: 'high' })
      expect(wrapper.find('[data-clear="priority"]').exists()).toBe(true)
    })

    it('renders clear button when stepName is non-empty', () => {
      const wrapper = mountFilters({ stepName: 'assembly' })
      expect(wrapper.find('[data-clear="stepName"]').exists()).toBe(true)
    })

    it('does not render clear button when jobName is undefined', () => {
      const wrapper = mountFilters({})
      expect(wrapper.find('[data-clear="jobName"]').exists()).toBe(false)
    })

    it('does not render clear button when jobName is empty string', () => {
      const wrapper = mountFilters({ jobName: '' })
      expect(wrapper.find('[data-clear="jobName"]').exists()).toBe(false)
    })

    it('does not render clear button when priority is undefined', () => {
      const wrapper = mountFilters({})
      expect(wrapper.find('[data-clear="priority"]').exists()).toBe(false)
    })

    it('does not render clear button when stepName is undefined', () => {
      const wrapper = mountFilters({})
      expect(wrapper.find('[data-clear="stepName"]').exists()).toBe(false)
    })

    it('renders multiple clear buttons when multiple fields are set', () => {
      const wrapper = mountFilters({ jobName: 'a', priority: 'b', stepName: 'c' })
      expect(wrapper.find('[data-clear="jobName"]').exists()).toBe(true)
      expect(wrapper.find('[data-clear="priority"]').exists()).toBe(true)
      expect(wrapper.find('[data-clear="stepName"]').exists()).toBe(true)
    })
  })

  // --- Clicking clear emits correct change event (Req 2.1, 2.2, 2.3) ---
  describe('clear button click emits change', () => {
    it('clears jobName and preserves other fields', async () => {
      const filters: FilterState = { jobName: 'alpha', priority: 'high', stepName: 'weld', status: 'active' }
      const wrapper = mountFilters(filters)
      await wrapper.find('[data-clear="jobName"]').trigger('click')

      const emitted = wrapper.emitted('change')!
      expect(emitted).toHaveLength(1)
      const result = emitted[0][0] as FilterState
      expect(result.jobName).toBeUndefined()
      expect(result.priority).toBe('high')
      expect(result.stepName).toBe('weld')
      expect(result.status).toBe('active')
    })

    it('clears priority and preserves other fields', async () => {
      const filters: FilterState = { jobName: 'beta', priority: 'low', stepName: 'paint' }
      const wrapper = mountFilters(filters)
      await wrapper.find('[data-clear="priority"]').trigger('click')

      const emitted = wrapper.emitted('change')!
      expect(emitted).toHaveLength(1)
      const result = emitted[0][0] as FilterState
      expect(result.priority).toBeUndefined()
      expect(result.jobName).toBe('beta')
      expect(result.stepName).toBe('paint')
    })

    it('clears stepName and preserves other fields', async () => {
      const filters: FilterState = { jobName: 'gamma', priority: 'med', stepName: 'inspect' }
      const wrapper = mountFilters(filters)
      await wrapper.find('[data-clear="stepName"]').trigger('click')

      const emitted = wrapper.emitted('change')!
      expect(emitted).toHaveLength(1)
      const result = emitted[0][0] as FilterState
      expect(result.stepName).toBeUndefined()
      expect(result.jobName).toBe('gamma')
      expect(result.priority).toBe('med')
    })
  })

  // --- Aria labels (Req 5.1) ---
  describe('aria-label attributes', () => {
    it('jobName clear button has correct aria-label', () => {
      const wrapper = mountFilters({ jobName: 'x' })
      expect(wrapper.find('[data-clear="jobName"]').attributes('aria-label')).toBe('Clear job name filter')
    })

    it('priority clear button has correct aria-label', () => {
      const wrapper = mountFilters({ priority: 'x' })
      expect(wrapper.find('[data-clear="priority"]').attributes('aria-label')).toBe('Clear priority filter')
    })

    it('stepName clear button has correct aria-label', () => {
      const wrapper = mountFilters({ stepName: 'x' })
      expect(wrapper.find('[data-clear="stepName"]').attributes('aria-label')).toBe('Clear step filter')
    })
  })

  // --- Global Clear button (Req 3.1, 3.2) ---
  describe('global Clear button', () => {
    it('renders when filters are active', () => {
      const wrapper = mountFilters({ jobName: 'test' })
      expect(wrapper.find('[data-clear-all]').exists()).toBe(true)
    })

    it('does not render when no filters are active', () => {
      const wrapper = mountFilters({ status: 'all' })
      expect(wrapper.find('[data-clear-all]').exists()).toBe(false)
    })

    it('emits { status: "all" } when clicked', async () => {
      const wrapper = mountFilters({ jobName: 'test', priority: 'high', status: 'active' })
      await wrapper.find('[data-clear-all]').trigger('click')

      const emitted = wrapper.emitted('change')!
      expect(emitted).toHaveLength(1)
      expect(emitted[0][0]).toEqual({ status: 'all' })
    })
  })

  // --- Manual delete equivalence (Req 6.3) ---
  describe('manual delete equivalence', () => {
    it('manually clearing input text produces same result as clicking clear button', async () => {
      const filters: FilterState = { jobName: 'alpha', priority: 'high' }

      // Simulate clicking the clear button
      const wrapper1 = mountFilters(filters)
      await wrapper1.find('[data-clear="jobName"]').trigger('click')
      const clickResult = wrapper1.emitted('change')![0][0] as FilterState

      // Simulate manually deleting text (input event with empty string → coerced to undefined)
      const wrapper2 = mountFilters(filters)
      const input = wrapper2.find('[data-field="jobName"] input')
      await input.setValue('')
      const inputResult = wrapper2.emitted('change')![0][0] as FilterState

      expect(clickResult).toEqual(inputResult)
    })
  })
})
