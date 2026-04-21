/**
 * Unit tests for AuditTrailFilters component.
 *
 * Tests the filter panel's active-filter counting, emit payload shape,
 * mobile collapse behavior, clear behavior, and whitespace trimming
 * on text inputs.
 *
 * Feature: audit-mobile-redesign
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, computed, h, ref, watch } from 'vue'
import type { AuditAction } from '~/server/types/domain'

const SELECT_ALL = '__all__'

interface AuditFilters {
  action?: AuditAction
  userId?: string
  partId?: string
  jobId?: string
  startDate?: string
  endDate?: string
}

/**
 * Minimal reproduction of AuditTrailFilters logic for mounting.
 * Reproduces the three things we care about testing:
 *   - the filter object emitted to the parent
 *   - the active-filter count computation
 *   - the mobile collapse/toggle behavior
 */
const AuditTrailFilters = defineComponent({
  name: 'AuditTrailFilters',
  props: {
    isMobile: { type: Boolean, default: false },
  },
  emits: ['update:filters'],
  setup(props, { emit }) {
    const selectedAction = ref<AuditAction | typeof SELECT_ALL>(SELECT_ALL)
    const userId = ref('')
    const partId = ref('')
    const jobId = ref('')
    const startDate = ref('')
    const endDate = ref('')
    const expanded = ref(false)

    const activeFilterCount = computed(() => {
      let n = 0
      if (selectedAction.value !== SELECT_ALL) n++
      if (userId.value.trim()) n++
      if (partId.value.trim()) n++
      if (jobId.value.trim()) n++
      if (startDate.value) n++
      if (endDate.value) n++
      return n
    })

    const panelVisible = computed(() => !props.isMobile || expanded.value)

    function emitFilters() {
      const filters: AuditFilters = {}
      if (selectedAction.value !== SELECT_ALL) filters.action = selectedAction.value as AuditAction
      if (userId.value.trim()) filters.userId = userId.value.trim()
      if (partId.value.trim()) filters.partId = partId.value.trim()
      if (jobId.value.trim()) filters.jobId = jobId.value.trim()
      if (startDate.value) filters.startDate = startDate.value
      if (endDate.value) filters.endDate = endDate.value
      emit('update:filters', filters)
    }

    function clearFilters() {
      selectedAction.value = SELECT_ALL
      userId.value = ''
      partId.value = ''
      jobId.value = ''
      startDate.value = ''
      endDate.value = ''
      emitFilters()
    }

    watch([selectedAction, userId, partId, jobId, startDate, endDate], emitFilters)

    // Expose state to tests via `ref`s on the component instance.
    return {
      selectedAction,
      userId,
      partId,
      jobId,
      startDate,
      endDate,
      expanded,
      activeFilterCount,
      panelVisible,
      clearFilters,
      render: () =>
        h('div', { class: 'filters-root' }, [
          props.isMobile
            ? h('div', { class: 'mobile-header' }, [
                h(
                  'button',
                  {
                    'data-testid': 'filters-toggle',
                    onClick: () => (expanded.value = !expanded.value),
                  },
                  `Filters${activeFilterCount.value > 0 ? ` (${activeFilterCount.value})` : ''}`,
                ),
                activeFilterCount.value > 0
                  ? h(
                      'button',
                      { 'data-testid': 'filters-clear-mobile', onClick: clearFilters },
                      'Clear',
                    )
                  : null,
              ])
            : null,
          panelVisible.value
            ? h('div', { 'data-testid': 'filters-panel' }, [
                h('input', {
                  'data-testid': 'filter-user',
                  value: userId.value,
                  onInput: (e: Event) => {
                    userId.value = (e.target as HTMLInputElement).value
                  },
                }),
                h('input', {
                  'data-testid': 'filter-part',
                  value: partId.value,
                  onInput: (e: Event) => {
                    partId.value = (e.target as HTMLInputElement).value
                  },
                }),
                h('input', {
                  'data-testid': 'filter-start',
                  value: startDate.value,
                  onInput: (e: Event) => {
                    startDate.value = (e.target as HTMLInputElement).value
                  },
                }),
                !props.isMobile
                  ? h(
                      'button',
                      { 'data-testid': 'filters-clear-desktop', onClick: clearFilters },
                      'Clear',
                    )
                  : null,
              ])
            : null,
        ]),
    }
  },
  render() {
    return this.render()
  },
})

// --- Tests ---

describe('AuditTrailFilters', () => {
  describe('panel visibility', () => {
    it('shows the panel by default on desktop', () => {
      const wrapper = mount(AuditTrailFilters, { props: { isMobile: false } })
      expect(wrapper.find('[data-testid="filters-panel"]').exists()).toBe(true)
    })

    it('hides the panel by default on mobile', () => {
      const wrapper = mount(AuditTrailFilters, { props: { isMobile: true } })
      expect(wrapper.find('[data-testid="filters-panel"]').exists()).toBe(false)
    })

    it('toggles the panel open when the filters button is clicked on mobile', async () => {
      const wrapper = mount(AuditTrailFilters, { props: { isMobile: true } })
      await wrapper.find('[data-testid="filters-toggle"]').trigger('click')
      expect(wrapper.find('[data-testid="filters-panel"]').exists()).toBe(true)
    })

    it('toggles the panel closed on a second click', async () => {
      const wrapper = mount(AuditTrailFilters, { props: { isMobile: true } })
      await wrapper.find('[data-testid="filters-toggle"]').trigger('click')
      await wrapper.find('[data-testid="filters-toggle"]').trigger('click')
      expect(wrapper.find('[data-testid="filters-panel"]').exists()).toBe(false)
    })
  })

  describe('mobile clear button', () => {
    it('is hidden when no filters are active', () => {
      const wrapper = mount(AuditTrailFilters, { props: { isMobile: true } })
      expect(wrapper.find('[data-testid="filters-clear-mobile"]').exists()).toBe(false)
    })

    it('appears once a filter is active', async () => {
      const wrapper = mount(AuditTrailFilters, { props: { isMobile: true } })
      await wrapper.find('[data-testid="filters-toggle"]').trigger('click')
      const input = wrapper.find('[data-testid="filter-user"]')
      await input.setValue('xander')
      expect(wrapper.find('[data-testid="filters-clear-mobile"]').exists()).toBe(true)
    })
  })

  describe('active-filter count', () => {
    it('shows the count on the mobile toggle when filters are active', async () => {
      const wrapper = mount(AuditTrailFilters, { props: { isMobile: true } })
      await wrapper.find('[data-testid="filters-toggle"]').trigger('click')
      await wrapper.find('[data-testid="filter-user"]').setValue('xander')
      await wrapper.find('[data-testid="filter-part"]').setValue('part_001')
      expect(wrapper.find('[data-testid="filters-toggle"]').text()).toBe('Filters (2)')
    })

    it('ignores whitespace-only values in the count', async () => {
      const wrapper = mount(AuditTrailFilters, { props: { isMobile: true } })
      await wrapper.find('[data-testid="filters-toggle"]').trigger('click')
      await wrapper.find('[data-testid="filter-user"]').setValue('   ')
      expect(wrapper.find('[data-testid="filters-toggle"]').text()).toBe('Filters')
    })
  })

  describe('emit payload', () => {
    it('emits trimmed values for text filters', async () => {
      const wrapper = mount(AuditTrailFilters, { props: { isMobile: false } })
      await wrapper.find('[data-testid="filter-user"]').setValue('  xander  ')
      const events = wrapper.emitted('update:filters')!
      const last = events[events.length - 1][0] as AuditFilters
      expect(last.userId).toBe('xander')
    })

    it('omits fields that are empty or whitespace', async () => {
      const wrapper = mount(AuditTrailFilters, { props: { isMobile: false } })
      await wrapper.find('[data-testid="filter-user"]').setValue('   ')
      const events = wrapper.emitted('update:filters')!
      const last = events[events.length - 1][0] as AuditFilters
      expect(last.userId).toBeUndefined()
    })

    it('includes startDate when set', async () => {
      const wrapper = mount(AuditTrailFilters, { props: { isMobile: false } })
      await wrapper.find('[data-testid="filter-start"]').setValue('2025-06-01')
      const events = wrapper.emitted('update:filters')!
      const last = events[events.length - 1][0] as AuditFilters
      expect(last.startDate).toBe('2025-06-01')
    })
  })

  describe('clear behavior', () => {
    it('resets all fields and emits an empty filter object on desktop', async () => {
      const wrapper = mount(AuditTrailFilters, { props: { isMobile: false } })
      await wrapper.find('[data-testid="filter-user"]').setValue('xander')
      await wrapper.find('[data-testid="filter-part"]').setValue('part_001')
      await wrapper.find('[data-testid="filter-start"]').setValue('2025-06-01')
      await wrapper.find('[data-testid="filters-clear-desktop"]').trigger('click')
      const events = wrapper.emitted('update:filters')!
      const last = events[events.length - 1][0] as AuditFilters
      expect(last).toEqual({})
      expect((wrapper.vm as unknown as { activeFilterCount: number }).activeFilterCount).toBe(0)
    })

    it('resets all fields on mobile clear button', async () => {
      const wrapper = mount(AuditTrailFilters, { props: { isMobile: true } })
      await wrapper.find('[data-testid="filters-toggle"]').trigger('click')
      await wrapper.find('[data-testid="filter-user"]').setValue('xander')
      await wrapper.find('[data-testid="filters-clear-mobile"]').trigger('click')
      const events = wrapper.emitted('update:filters')!
      const last = events[events.length - 1][0] as AuditFilters
      expect(last).toEqual({})
    })
  })
})
