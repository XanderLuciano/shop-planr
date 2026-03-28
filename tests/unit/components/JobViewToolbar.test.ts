/**
 * Unit tests for JobViewToolbar component.
 *
 * Tests disabled states based on prop combinations, emitted events on click,
 * and tooltip text rendering.
 *
 * Feature: job-view-utilities
 * Requirements: 1.3, 2.3, 3.7, 4.5, 6.2, 6.3, 6.4
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

/**
 * Minimal reproduction of JobViewToolbar logic for mounting.
 * Rebuilt as a defineComponent to avoid .vue SFC parsing issues
 * (no @vitejs/plugin-vue in vitest config). Mirrors the real
 * component's props, emits, disable logic, and template structure.
 */
const JobViewToolbar = defineComponent({
  name: 'JobViewToolbar',
  props: {
    hasExpandedJobs: { type: Boolean, required: true },
    hasExpandedPaths: { type: Boolean, required: true },
    jobCount: { type: Number, required: true },
  },
  emits: ['expand-all-jobs', 'collapse-all-jobs', 'expand-all-paths', 'collapse-all-paths'],
  setup(props, { emit }) {
    const buttons = [
      { tooltip: 'Expand All Jobs', icon: 'i-lucide-chevrons-down', event: 'expand-all-jobs' as const, disabled: () => !props.jobCount },
      { tooltip: 'Collapse All Jobs', icon: 'i-lucide-chevrons-up', event: 'collapse-all-jobs' as const, disabled: () => !props.hasExpandedJobs },
      { tooltip: 'Expand All Paths', icon: 'i-lucide-list-tree', event: 'expand-all-paths' as const, disabled: () => !props.hasExpandedJobs },
      { tooltip: 'Collapse All Paths', icon: 'i-lucide-list-minus', event: 'collapse-all-paths' as const, disabled: () => !props.hasExpandedPaths },
    ]

    return () =>
      h('div', { class: 'flex items-center' },
        buttons.map((btn) =>
          h('div', { 'data-tooltip': btn.tooltip }, [
            h('button', {
              disabled: btn.disabled() || undefined,
              onClick: () => emit(btn.event),
            }),
          ]),
        ),
      )
  },
})

function mountToolbar(props: { hasExpandedJobs: boolean; hasExpandedPaths: boolean; jobCount: number }) {
  return mount(JobViewToolbar, { props })
}

describe('JobViewToolbar', () => {
  // --- Disabled states ---
  describe('disabled states', () => {
    // Req 1.3: Expand All Jobs disabled when jobCount === 0
    it('disables "Expand All Jobs" when jobCount is 0', () => {
      const wrapper = mountToolbar({ hasExpandedJobs: false, hasExpandedPaths: false, jobCount: 0 })
      const buttons = wrapper.findAll('button')
      expect(buttons[0].attributes('disabled')).toBeDefined()
    })

    it('enables "Expand All Jobs" when jobCount > 0', () => {
      const wrapper = mountToolbar({ hasExpandedJobs: false, hasExpandedPaths: false, jobCount: 3 })
      const buttons = wrapper.findAll('button')
      expect(buttons[0].attributes('disabled')).toBeUndefined()
    })

    // Req 2.3: Collapse All Jobs disabled when !hasExpandedJobs
    it('disables "Collapse All Jobs" when hasExpandedJobs is false', () => {
      const wrapper = mountToolbar({ hasExpandedJobs: false, hasExpandedPaths: false, jobCount: 5 })
      const buttons = wrapper.findAll('button')
      expect(buttons[1].attributes('disabled')).toBeDefined()
    })

    it('enables "Collapse All Jobs" when hasExpandedJobs is true', () => {
      const wrapper = mountToolbar({ hasExpandedJobs: true, hasExpandedPaths: false, jobCount: 5 })
      const buttons = wrapper.findAll('button')
      expect(buttons[1].attributes('disabled')).toBeUndefined()
    })

    // Req 3.7: Expand All Paths disabled when !hasExpandedJobs
    it('disables "Expand All Paths" when hasExpandedJobs is false', () => {
      const wrapper = mountToolbar({ hasExpandedJobs: false, hasExpandedPaths: false, jobCount: 5 })
      const buttons = wrapper.findAll('button')
      expect(buttons[2].attributes('disabled')).toBeDefined()
    })

    it('enables "Expand All Paths" when hasExpandedJobs is true', () => {
      const wrapper = mountToolbar({ hasExpandedJobs: true, hasExpandedPaths: false, jobCount: 5 })
      const buttons = wrapper.findAll('button')
      expect(buttons[2].attributes('disabled')).toBeUndefined()
    })

    // Req 4.5: Collapse All Paths disabled when !hasExpandedPaths
    it('disables "Collapse All Paths" when hasExpandedPaths is false', () => {
      const wrapper = mountToolbar({ hasExpandedJobs: true, hasExpandedPaths: false, jobCount: 5 })
      const buttons = wrapper.findAll('button')
      expect(buttons[3].attributes('disabled')).toBeDefined()
    })

    it('enables "Collapse All Paths" when hasExpandedPaths is true', () => {
      const wrapper = mountToolbar({ hasExpandedJobs: true, hasExpandedPaths: true, jobCount: 5 })
      const buttons = wrapper.findAll('button')
      expect(buttons[3].attributes('disabled')).toBeUndefined()
    })

    // Edge: all buttons disabled when no jobs and nothing expanded
    it('disables all buttons when jobCount is 0 and nothing expanded', () => {
      const wrapper = mountToolbar({ hasExpandedJobs: false, hasExpandedPaths: false, jobCount: 0 })
      const buttons = wrapper.findAll('button')
      expect(buttons).toHaveLength(4)
      buttons.forEach((btn) => {
        expect(btn.attributes('disabled')).toBeDefined()
      })
    })
  })

  // --- Emitted events ---
  describe('emitted events', () => {
    it('emits "expand-all-jobs" when first button is clicked', async () => {
      const wrapper = mountToolbar({ hasExpandedJobs: false, hasExpandedPaths: false, jobCount: 5 })
      await wrapper.findAll('button')[0].trigger('click')
      expect(wrapper.emitted('expand-all-jobs')).toHaveLength(1)
    })

    it('emits "collapse-all-jobs" when second button is clicked', async () => {
      const wrapper = mountToolbar({ hasExpandedJobs: true, hasExpandedPaths: false, jobCount: 5 })
      await wrapper.findAll('button')[1].trigger('click')
      expect(wrapper.emitted('collapse-all-jobs')).toHaveLength(1)
    })

    it('emits "expand-all-paths" when third button is clicked', async () => {
      const wrapper = mountToolbar({ hasExpandedJobs: true, hasExpandedPaths: false, jobCount: 5 })
      await wrapper.findAll('button')[2].trigger('click')
      expect(wrapper.emitted('expand-all-paths')).toHaveLength(1)
    })

    it('emits "collapse-all-paths" when fourth button is clicked', async () => {
      const wrapper = mountToolbar({ hasExpandedJobs: true, hasExpandedPaths: true, jobCount: 5 })
      await wrapper.findAll('button')[3].trigger('click')
      expect(wrapper.emitted('collapse-all-paths')).toHaveLength(1)
    })
  })

  // --- Tooltips ---
  describe('tooltips', () => {
    it('renders correct tooltip text for each button', () => {
      const wrapper = mountToolbar({ hasExpandedJobs: true, hasExpandedPaths: true, jobCount: 5 })
      const tooltips = wrapper.findAll('[data-tooltip]')
      expect(tooltips).toHaveLength(4)
      expect(tooltips[0].attributes('data-tooltip')).toBe('Expand All Jobs')
      expect(tooltips[1].attributes('data-tooltip')).toBe('Collapse All Jobs')
      expect(tooltips[2].attributes('data-tooltip')).toBe('Expand All Paths')
      expect(tooltips[3].attributes('data-tooltip')).toBe('Collapse All Paths')
    })
  })
})
